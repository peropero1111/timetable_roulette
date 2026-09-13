    const canvas = document.getElementById("rouletteCanvas");
    const ctx = canvas.getContext("2d");
    const DAY_MINUTES = 24 * 60;

    // 기본 일정 리스트 (초기값)
    let items = buildClockItems([
        { schedule: "잠", time: "4시간", minutes: 240 },
        { schedule: "잠", time: "4시간", minutes: 240 },
        { schedule: "잠", time: "4시간", minutes: 240 },
        { schedule: "잠", time: "4시간", minutes: 240 },
        { schedule: "잠", time: "4시간", minutes: 240 },
        { schedule: "잠", time: "4시간", minutes: 240 }
    ]);

    // 부채꼴 색상들 (반복 사용)
    const colors = ["#ff6b6b", "#feca57", "#1dd1a1", "#54a0ff", "#5f27cd", "#ff9ff3", "#48dbfb"];

    function setupCanvasStyle() {
        canvas.style.border = "none";
    }

    function setupScheduleTimeInputs() {
        const scheduleInput = document.getElementById("menu-input");
        const inputContainer = scheduleInput?.closest(".input-container");

        if (!scheduleInput || !inputContainer || document.getElementById("time-input")) {
            return;
        }

        scheduleInput.placeholder = "일정을 콤마(,)로 구분해 주세요 (예: 공부, 운동)";
        scheduleInput.setAttribute("aria-label", "일정 입력");

        const timeInput = document.createElement("input");
        timeInput.type = "text";
        timeInput.id = "time-input";
        timeInput.placeholder = "각 일정의 길이를 콤마(,)로 구분해 주세요 (예: 12:00, 1시간, 30분)";
        timeInput.setAttribute("aria-label", "시간 입력");

        inputContainer.style.display = "flex";
        inputContainer.style.flexWrap = "wrap";
        inputContainer.style.justifyContent = "center";
        inputContainer.style.gap = "8px";

        const applyButton = inputContainer.querySelector("button");
        inputContainer.insertBefore(timeInput, applyButton);
    }

    function splitInput(value) {
        return value.split(",")
            .map(item => item.trim())
            .filter(item => item !== "");
    }

    function parseDurationToMinutes(value) {
        const text = value.trim().replace(/\s+/g, "");

        const hourMinuteMatch = text.match(/^(\d+(?:\.\d+)?)시간(?:(\d+(?:\.\d+)?)분)?$/);
        if (hourMinuteMatch) {
            const hours = Number(hourMinuteMatch[1]);
            const minutes = Number(hourMinuteMatch[2] || 0);
            return (hours * 60) + minutes;
        }

        const minuteMatch = text.match(/^(\d+(?:\.\d+)?)분$/);
        if (minuteMatch) {
            return Number(minuteMatch[1]);
        }

        const colonMatch = text.match(/^(\d+):([0-5]\d)$/);
        if (colonMatch) {
            return (Number(colonMatch[1]) * 60) + Number(colonMatch[2]);
        }

        const numberMatch = text.match(/^\d+(?:\.\d+)?$/);
        if (numberMatch) {
            return Number(text) * 60;
        }

        return NaN;
    }

    function formatClock(minutes) {
        const normalizedMinutes = ((Math.round(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
        const hours = String(Math.floor(normalizedMinutes / 60)).padStart(2, "0");
        const mins = String(normalizedMinutes % 60).padStart(2, "0");

        return `${hours}:${mins}`;
    }

    function formatDuration(minutes) {
        const roundedMinutes = Math.round(minutes);
        const hours = Math.floor(roundedMinutes / 60);
        const mins = roundedMinutes % 60;

        if (hours > 0 && mins > 0) {
            return `${hours}시간 ${mins}분`;
        }

        if (hours > 0) {
            return `${hours}시간`;
        }

        return `${mins}분`;
    }

    function buildClockItems(scheduleItems) {
        let cursor = 0;
        const clockItems = scheduleItems.map(item => {
            const startMinutes = cursor;
            const endMinutes = cursor + item.minutes;
            cursor = endMinutes;

            return {
                ...item,
                startMinutes,
                endMinutes,
                range: `${formatClock(startMinutes)}-${formatClock(endMinutes)}`
            };
        });

        if (cursor < DAY_MINUTES) {
            clockItems.push({
                schedule: "빈 시간",
                time: formatDuration(DAY_MINUTES - cursor),
                minutes: DAY_MINUTES - cursor,
                startMinutes: cursor,
                endMinutes: DAY_MINUTES,
                range: `${formatClock(cursor)}-${formatClock(DAY_MINUTES)}`,
                isEmpty: true
            });
        }

        return clockItems;
    }

    function getTotalMinutes() {
        return items.reduce((total, item) => total + item.minutes, 0);
    }

    function getWinningIndex(angleDegrees) {
        const totalMinutes = getTotalMinutes();
        let currentDegrees = 0;

        for (let index = 0; index < items.length; index++) {
            const segmentDegrees = (items[index].minutes / totalMinutes) * 360;

            if (angleDegrees >= currentDegrees && angleDegrees < currentDegrees + segmentDegrees) {
                return index;
            }

            currentDegrees += segmentDegrees;
        }

        return items.length - 1;
    }

    function getBoundaryLabels() {
        const labels = [];
        const seenMinutes = new Set();

        items.forEach(item => {
            [item.startMinutes, item.endMinutes].forEach(minutes => {
                const minuteKey = Math.round(minutes) % DAY_MINUTES;

                if (seenMinutes.has(minuteKey)) {
                    return;
                }

                seenMinutes.add(minuteKey);
                labels.push({
                    minutes: minuteKey,
                    text: formatClock(minuteKey)
                });
            });
        });

        return labels.sort((a, b) => a.minutes - b.minutes);
    }

    function doBoxesOverlap(firstBox, secondBox) {
        return firstBox.left < secondBox.right &&
            firstBox.right > secondBox.left &&
            firstBox.top < secondBox.bottom &&
            firstBox.bottom > secondBox.top;
    }

    function createTextBox(x, y, width, height, align) {
        const padding = 3;
        let left = x;

        if (align === "right") {
            left = x - width;
        } else if (align === "center") {
            left = x - (width / 2);
        }

        return {
            left: left - padding,
            right: left + width + padding,
            top: y - (height / 2) - padding,
            bottom: y + (height / 2) + padding
        };
    }

    function drawBoundaryTimeLabels(center, labelRadius, totalMinutes) {
        const drawnBoxes = [];

        ctx.save();
        ctx.font = "bold 12px Arial";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#222222";
        ctx.shadowBlur = 3;
        ctx.shadowColor = "rgba(255,255,255,0.95)";

        getBoundaryLabels().forEach(label => {
            const angle = -Math.PI / 2 + (label.minutes / totalMinutes) * 2 * Math.PI;
            const labelX = center + Math.cos(angle) * labelRadius;
            const labelY = center + Math.sin(angle) * labelRadius;
            const align = labelX > center + 5 ? "right" : labelX < center - 5 ? "left" : "center";
            const textWidth = ctx.measureText(label.text).width;
            const textBox = createTextBox(labelX, labelY, textWidth, 12, align);
            const isOverlapping = drawnBoxes.some(box => doBoxesOverlap(box, textBox));

            if (isOverlapping) {
                return;
            }

            ctx.textAlign = align;
            ctx.fillText(label.text, labelX, labelY);
            drawnBoxes.push(textBox);
        });

        ctx.restore();
    }

    // 룰렛을 그리는 함수
    function drawRoulette() {
        const center = canvas.width / 2;
        const radius = center - 34;
        const labelRadius = radius + 19;
        const maxTextWidth = radius - 30;
        const totalMinutes = getTotalMinutes();
        let currentAngle = -Math.PI / 2;

        // 캔버스 초기화
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        items.forEach((item, index) => {
            const segmentAngle = (item.minutes / totalMinutes) * 2 * Math.PI;
            const startAngle = currentAngle;
            const endAngle = startAngle + segmentAngle;
            const middleAngle = startAngle + (segmentAngle / 2);

            // 1. 부채꼴 칸 그리기
            ctx.beginPath();
            ctx.moveTo(center, center);
            ctx.arc(center, center, radius, startAngle, endAngle);
            ctx.fillStyle = item.isEmpty ? "#d9dee7" : colors[index % colors.length];
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();

            // 2. 일정 글자 넣기
            const middleMinutes = item.startMinutes + (item.minutes / 2);
            const shouldFlipText = middleMinutes >= DAY_MINUTES / 2;

            ctx.save();
            ctx.translate(center, center);
            // 글자가 칸의 정중앙에 오도록 각도 회전
            ctx.rotate(shouldFlipText ? middleAngle + Math.PI : middleAngle);

            ctx.textAlign = shouldFlipText ? "left" : "right";
            ctx.fillStyle = item.isEmpty ? "#596273" : "#ffffff";
            ctx.shadowBlur = 4;
            ctx.shadowColor = "rgba(0,0,0,0.5)";

            // 중심에서 약간 바깥쪽에 일정 배치
            ctx.font = "bold 16px Arial";
            ctx.fillText(item.schedule, shouldFlipText ? -(radius - 18) : radius - 18, 5, maxTextWidth);
            ctx.restore();

            currentAngle = endAngle;
        });

        drawBoundaryTimeLabels(center, labelRadius, totalMinutes);
    }

    // 사용자가 입력한 일정과 시간으로 룰렛 바꾸기
    function updateRoulette() {
        const scheduleInput = document.getElementById("menu-input");
        const timeInput = document.getElementById("time-input");
        const schedules = splitInput(scheduleInput.value);
        const times = splitInput(timeInput.value);

        if (schedules.length === 0 || times.length === 0) {
            alert("일정과 시간을 모두 입력해 주세요!");
            return;
        }

        if (schedules.length < 2 || times.length < 2) {
            alert("최소 2개 이상의 일정과 시간을 입력해 주세요.");
            return;
        }

        if (schedules.length !== times.length) {
            alert("일정 개수와 시간 개수를 같게 입력해 주세요.");
            return;
        }

        const durations = times.map(time => parseDurationToMinutes(time));
        const invalidIndex = durations.findIndex(minutes => !Number.isFinite(minutes) || minutes <= 0);

        if (invalidIndex !== -1) {
            alert("시간은 12:00, 2시간, 30분 같은 일정 길이 형식으로 입력해 주세요.");
            return;
        }

        const totalDuration = durations.reduce((total, minutes) => total + minutes, 0);

        if (totalDuration > DAY_MINUTES) {
            alert("총 배정 시간은 24시간을 넘을 수 없습니다.");
            return;
        }

        items = buildClockItems(schedules.map((schedule, index) => ({
            schedule,
            time: times[index],
            minutes: durations[index]
        })));

        canvas.style.transition = "none";
        canvas.style.transform = "rotate(0deg)";
        drawRoulette(); // 다시 그리기
    }

    // 회전 애니메이션 제어 변수들
    let isSpinning = false;

    function spinRoulette() {
        if (isSpinning) return; // 이미 돌고 있으면 클릭 방지
        isSpinning = true;

        // 랜덤으로 많이 돌게 각도 설정 (최소 5바퀴 + 알파)
        const randomRotation = Math.floor(Math.random() * 360) + 1800;

        // CSS 대신 Canvas 자체를 돌리지 않고 쉽게 하기 위해 CSS transform을 활용합니다.
        canvas.style.transition = "transform 3s ease-out"; // 3초 동안 부드럽게 멈춤
        canvas.style.transform = `rotate(${randomRotation}deg)`;

        // 회전이 끝난 후 결과 계산
        setTimeout(() => {
            isSpinning = false;

            // 실제 멈춘 각도 계산 (360도 나머지)
            const actualDegrees = randomRotation % 360;

            // 00:00이 위쪽 화살표 위치에서 시작하므로 그 기준으로 결과 인덱스 찾기
            const winningAngle = (360 - actualDegrees) % 360;
            const winningIndex = getWinningIndex(winningAngle);

            const winningItem = items[winningIndex];

            alert(`선택된 시간대는 [ ${winningItem.range} ], 일정은 [ ${winningItem.schedule} ] 입니다!`);

            // 다음 번 돌리기를 위해 각도 리셋 (부드러운 효과를 위해 transition 잠시 제거)
            canvas.style.transition = "none";
            canvas.style.transform = `rotate(${actualDegrees}deg)`;
        }, 3000);
    }

    // 처음 화면이 켜졌을 때 기본 룰렛 그려두기
    setupCanvasStyle();
    setupScheduleTimeInputs();
    drawRoulette();
