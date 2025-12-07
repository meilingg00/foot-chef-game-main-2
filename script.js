/*********************** FIREBASE *************************/
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const statusRef = db.ref("smartFloor/status");

let smartFloorConnected = false;

statusRef.on("value", snap => {
    smartFloorConnected = snap.val();
    const icon = document.getElementById("connIcon");
    icon.textContent = smartFloorConnected ? "✅" : "❌";
});

/*********************** GAME DATA *************************/
const recipes = [
    {
        name: "Hotpot",
        image: "images/hotpot.png",
        ingredients: ["fishcake", "lettuce", "meat", "mushroom"]
    },
    {
        name: "Sandwich",
        image: "images/sandwich.png",
        ingredients: ["cheese", "beef", "mayo", "bread"]
    },
    {
        name: "Strawberry Cake",
        image: "images/strawberrycake.png",
        ingredients: ["strawberry", "milk", "flour", "eggs"]
    }
];

// 干擾項
const wrongItems = ["chilli", "rat", "watermelon", "deathfish"];

let currentDishIndex = 0;
let collected = [];
let activeCells = [];
let timers = {};

let timer = 20; // ✅ 修改這裡：初始設定為 20 秒
let timerInterval;
let score = 0;

/* 音效物件 */
const sndCorrect = document.getElementById("sndCorrect");
const sndWrong = document.getElementById("sndWrong");
const sndWin = document.getElementById("sndWin");

function playSound(audio) {
    if(audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Audio play failed", e));
    }
}

function updateScore(n) {
    score += n;
    document.getElementById("score").innerText = score;
}

const cells = document.querySelectorAll(".cell");

/*********************** START *************************/
document.getElementById("startBtn").onclick = () => {
    startGame();
};

function startGame() {
    document.getElementById("startScreen").classList.add("hidden");
    document.getElementById("gameScreen").classList.remove("hidden");
    document.getElementById("endScreen").classList.add("hidden");

    currentDishIndex = 0;
    collected = [];
    score = 0;
    updateScore(0);
    document.getElementById("completed").innerHTML = "";

    loadDish();
    startSpawning();
    startTimer();
}

/*********************** LOAD DISH *************************/
function loadDish() {
    const dish = recipes[currentDishIndex];
    document.getElementById("dishName").innerText = dish.name;
    document.getElementById("dishImg").src = dish.image;

    const needDiv = document.getElementById("neededIngredients");
    needDiv.innerHTML = "";

    dish.ingredients.forEach(i => {
        let img = document.createElement("img");
        img.src = `images/${i}.png`;
        img.dataset.item = i;
        needDiv.appendChild(img);
    });

    collected = [];
}

/*********************** SPAWN (LOGIC FIXED) *************************/
function randomWrong() {
    return wrongItems[Math.floor(Math.random() * wrongItems.length)];
}

function randomItem() {
    const dish = recipes[currentDishIndex];
    const needed = dish.ingredients;

    // 🔥 邏輯修正：只篩選「還沒收集到」的食材
    const remaining = needed.filter(i => !collected.includes(i));
    
    let pool = [];

    // 如果全部收集滿了(理論上會進下一關，但防止Bug)，就只出干擾項
    if (remaining.length === 0) {
        return randomWrong();
    }

    // 增加權重：還沒拿到的正確食材放 4 份
    remaining.forEach(i => {
        pool.push(i, i, i, i);
    });

    // 干擾項放 2 份
    pool.push(randomWrong());
    pool.push(randomWrong());

    return pool[Math.floor(Math.random() * pool.length)];
}

function spawn(cell) {
    let item = randomItem();

    cell.innerHTML = "";
    cell.className = "cell"; // 重置樣式

    let img = document.createElement("img");
    img.src = `images/${item}.png`;
    cell.appendChild(img);

    cell.dataset.item = item;

    if (!activeCells.includes(cell)) activeCells.push(cell);

    if (timers[cell.dataset.index]) clearTimeout(timers[cell.dataset.index]);

    // 3秒後消失
    timers[cell.dataset.index] = setTimeout(() => {
        remove(cell);
    }, 3000);
}

function remove(cell) {
    cell.innerHTML = "";
    cell.dataset.item = "";
    cell.className = "cell"; // 移除所有特效class

    const idx = activeCells.indexOf(cell);
    if (idx !== -1) activeCells.splice(idx, 1);
}

function startSpawning() {
    setInterval(() => {
        // 限制畫面上同時存在的物品數量，避免眼花撩亂
        if (activeCells.length < 5) {
            let free = [...cells].filter(c => !activeCells.includes(c));
            if (free.length === 0) return;
            const c = free[Math.floor(Math.random() * free.length)];
            spawn(c);
        }
    }, 800);
}

/*********************** CLICK & INTERACTION *************************/
cells.forEach(c => {
    c.onclick = () => {
        const item = c.dataset.item;
        if (!item) return; // 點到空的不算

        const needed = recipes[currentDishIndex].ingredients;

        // 判斷是否為「需要的」且「還沒拿過的」
        if (needed.includes(item) && !collected.includes(item)) {
            // ✅ 答對
            playSound(sndCorrect);
            collected.push(item);
            
            // 視覺特效：變綠 + 彈跳
            c.classList.add("correct-flash");

            // 更新下方清單狀態
            let listImg = document.querySelector(`#neededIngredients img[data-item="${item}"]`);
            if (listImg) listImg.classList.add("collected");

            updateScore(10);
            
            // 立即移除該格內容 (防止連點)
            setTimeout(() => remove(c), 200);

        } else {
            // ❌ 答錯
            playSound(sndWrong);
            updateScore(-5); // 扣分輕一點，老人家比較不挫折
            
            // 視覺特效：變紅 + 搖晃
            c.classList.add("wrong-flash");
            
            // 稍後移除
            setTimeout(() => remove(c), 400);
        }

        // 檢查是否過關
        if (collected.length === needed.length) {
            setTimeout(completeDish, 500); // 稍微延遲讓玩家看到最後一個收集特效
        }
    };
});

/*********************** COMPLETE LEVEL *************************/
function completeDish() {
    const dish = recipes[currentDishIndex];
    
    // 播放過關小音效(可選)
    playSound(sndCorrect); 

    const img = document.createElement("img");
    img.src = dish.image;
    document.getElementById("completed").appendChild(img);

    updateScore(30);

    currentDishIndex++;
    if (currentDishIndex >= recipes.length) {
        currentDishIndex = 0; // 循環玩
    }

    loadDish();
}

/*********************** TIMER & END GAME *************************/
function startTimer() {
    timer = 20; // ✅ 修改這裡：設定為 20 秒
    document.getElementById("timer").innerText = timer;

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timer--;
        document.getElementById("timer").innerText = timer;

        if (timer <= 0) {
            clearInterval(timerInterval);
            showEndScreen();
        }
    }, 1000);
}

function showEndScreen() {
    playSound(sndWin); // 遊戲結束音效
    
    document.getElementById("gameScreen").classList.add("hidden");
    document.getElementById("endScreen").classList.remove("hidden");
    document.getElementById("finalScore").innerText = score;

    // 統計煮了什麼
    const completedImgs = document.querySelectorAll("#completed img");
    const dishCount = {};
    completedImgs.forEach(img => {
        let name = img.src.split("/").pop().replace(".png", ""); 
        if (!dishCount[name]) dishCount[name] = 0;
        dishCount[name]++;
    });

    const box = document.getElementById("finalDishes");
    box.innerHTML = "";

    for (let name in dishCount) {
        const div = document.createElement("div");
        div.classList.add("item");
        
        const img = document.createElement("img");
        img.src = "images/" + name + ".png";
        
        const text = document.createElement("div");
        text.innerText = "x " + dishCount[name];
        text.style.fontWeight = "bold";
        text.style.fontSize = "24px";

        div.appendChild(img);
        div.appendChild(text);
        box.appendChild(div);
    }
}

document.getElementById("playAgainBtn").onclick = () => {
    startGame();
};