// Solo Leveling V4 Advanced Mechanics Engine

class CareerRPG {
    constructor() {
        this.baseStats = {
            designation: null,
            careerPath: null,  // 'tech' or 'nontech'
            level: 1,
            xp: 0,
            coins: 0,
            honor: 100,
            intelligence: 10,
            consistency: 10,
            focus: 10,
            communication: 10,
            ambition: 10,
            questsCompleted: 0,
            
            lastLoginDate: null,
            streakDays: 0,
            missedTasks: 0,
            bossHP: 1000,
            bossMaxHP: 1000,
            skillsUnlocked: [],
            unlockedFeatures: []
        };

        this.levelTitles = {
            1: "E-Rank Trainee",
            5: "D-Rank Novice",
            10: "C-Rank Adept",
            20: "B-Rank Professional",
            30: "A-Rank Expert",
            50: "S-Rank Master",
            100: "National Level Hunter"
        };

        this.mentorQuotes = {
            login: ["The System evaluates your discipline.", "Prove your worth today.", "Excuses are not measurable metrics."],
            levelUp: ["Threshold surpassed. The difficulty scales.", "Do not let arrogance cloud your focus."],
            failure: ["Unacceptable deviation from the objective.", "Your stats reflect your choices.", "The Abyss watches your failure."]
        };

        this.quizBank = [
            { q: "What is the time complexity of binary search?", opts: ["O(1)", "O(log n)", "O(n)", "O(n^2)"], ans: "O(log n)" },
            { q: "Which data structure uses LIFO?", opts: ["Queue", "Tree", "Stack", "Graph"], ans: "Stack" },
            { q: "What is the primary purpose of a foreign key in SQL?", opts: ["Sorting data", "Indexing tables", "Referential integrity", "Data encryption"], ans: "Referential integrity" }
        ];

        this.activeQuests = [];
        this.questTimerInterval = null;
        
        this.state = this.loadState();
        this.initDOM();
        this.bindEvents();
        
        if (!this.state.designation) {
            this.showSetupScreen();
        } else {
            this.hideSetupScreen();
            this.verifyBossScaling();
            this.processDailyLogin().then(() => {
                this.renderQuests();
                this.refreshUI();
            });
        }
    }

    loadState() {
        const saved = localStorage.getItem('careerRPG_V4State');
        const state = saved ? JSON.parse(saved) : { ...this.baseStats };
        
        // Retroactive fix for users who created accounts before Honor defaulted to 100
        if (state.honor === undefined || state.honor === null || state.honor === 0) {
            state.honor = 100;
        }
        
        const savedQuests = localStorage.getItem('careerRPG_V4Quests');
        if (savedQuests) {
            this.activeQuests = JSON.parse(savedQuests).filter(q => q.timeLimit > 0);
        }
        // V16: Try loading from MongoDB cloud save
        this.loadFromCloud();
        return state;
    }

    saveState() {
        localStorage.setItem('careerRPG_V4State', JSON.stringify(this.state));
        localStorage.setItem('careerRPG_V4Quests', JSON.stringify(this.activeQuests));
        // V16: Sync to MongoDB in background
        this.saveToCloud();
    }

    async saveToCloud() {
        const uid = localStorage.getItem('userId');
        if (!uid) return;
        try {
            await fetch(`${API_BASE_URL}/api/rpg/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid, state: this.state, quests: this.activeQuests })
            });
        } catch(e) { /* silent — localStorage is the fallback */ }
    }

    async loadFromCloud() {
        const uid = localStorage.getItem('userId');
        if (!uid) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/rpg/load/${uid}`);
            const data = await res.json();
            if (data.state && data.state.designation) {
                // Cloud save exists — use it if level is higher or equal
                const cloudLevel = data.state.level || 1;
                const localLevel = this.state.level || 1;
                if (cloudLevel >= localLevel) {
                    this.state = { ...this.baseStats, ...data.state };
                    
                    // Retroactive fix for users who created accounts before Honor defaulted to 100
                    if (this.state.honor === undefined || this.state.honor === null || this.state.honor === 0) {
                        this.state.honor = 100;
                    }
                    
                    if (data.quests && data.quests.length > 0) {
                        this.activeQuests = data.quests.filter(q => q.timeLimit > 0);
                    }
                    localStorage.setItem('careerRPG_V4State', JSON.stringify(this.state));
                    localStorage.setItem('careerRPG_V4Quests', JSON.stringify(this.activeQuests));
                    this.refreshUI();
                    console.log('[RPG] Cloud save loaded successfully');
                }
            }
        } catch(e) { /* silent fallback to localStorage */ }
    }

    initDOM() {
        this.modal = document.getElementById('rpgModal');
        this.openBtn = document.getElementById('rpgOpenBtn');
        this.closeBtn = document.getElementById('rpgCloseBtn');
        
        this.setupScreen = document.getElementById('rpgSetupScreen');
        this.mainContent = document.getElementById('rpgMainContent');
        this.designationInput = document.getElementById('optDesignation');
        this.awakenBtn = document.getElementById('btnAwaken');
        
        this.lvlText = document.getElementById('rpgLvlText');
        this.titleText = document.getElementById('rpgTitleText');
        this.classText = document.getElementById('rpgClassText');
        this.xpBar = document.getElementById('rpgXpBar');
        this.xpText = document.getElementById('rpgXpText');
        
        this.coinsVal = document.getElementById('rpgValCoins');
        this.honorVal = document.getElementById('rpgValHonor');
        this.streakVal = document.getElementById('rpgValStreak');
        
        this.statBars = { intelligence: document.getElementById('rpg-stat-int'), consistency: document.getElementById('rpg-stat-con'), focus: document.getElementById('rpg-stat-foc'), communication: document.getElementById('rpg-stat-com'), ambition: document.getElementById('rpg-stat-amb') };
        this.statVals = { intelligence: document.getElementById('rpg-val-int'), consistency: document.getElementById('rpg-val-con'), focus: document.getElementById('rpg-val-foc'), communication: document.getElementById('rpg-val-com'), ambition: document.getElementById('rpg-val-amb') };

        this.questContainer = document.getElementById('rpgQuestList');
        this.mentorText = document.getElementById('mentorMessageText');
        this.bossHpFill = document.getElementById('bossHpFill');
        this.bossHpText = document.getElementById('bossHpText');
        this.btnAttack = document.getElementById('btnAttackBoss');
        
        this.storeBtn = document.getElementById('rpgExchangeBtn');
        this.storeScreen = document.getElementById('rpgStoreScreen');
    }

    bindEvents() {
        if(this.openBtn) this.openBtn.addEventListener('click', () => this.openModal());
        if(this.closeBtn) this.closeBtn.addEventListener('click', () => this.closeModal());
        if(this.awakenBtn) this.awakenBtn.addEventListener('click', () => this.awakenPlayer());
        
        if(this.btnAttack) {
            this.btnAttack.addEventListener('click', () => this.attackBoss());
        }

        if(this.storeBtn) this.storeBtn.addEventListener('click', () => this.toggleStore());

        // V17: Path card selection highlighting
        document.querySelectorAll('input[name="careerPath"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const techCard = document.getElementById('cardTech');
                const nonTechCard = document.getElementById('cardNonTech');
                if (radio.value === 'tech') {
                    techCard.style.borderColor = '#6366f1'; techCard.style.background = 'rgba(99,102,241,0.15)';
                    nonTechCard.style.borderColor = 'rgba(236,72,153,0.2)'; nonTechCard.style.background = 'rgba(236,72,153,0.08)';
                } else {
                    nonTechCard.style.borderColor = '#ec4899'; nonTechCard.style.background = 'rgba(236,72,153,0.15)';
                    techCard.style.borderColor = 'rgba(99,102,241,0.2)'; techCard.style.background = 'rgba(99,102,241,0.08)';
                }
            });
        });

        // V17: Switch Path button
        const switchPathBtn = document.getElementById('rpgSwitchPathBtn');
        if (switchPathBtn) {
            switchPathBtn.addEventListener('click', () => {
                if (confirm('⚠️ Switching path will reset your quests (stats & level are kept). Continue?')) {
                    this.state.careerPath = null;
                    this.state.designation = null;
                    this.activeQuests = [];
                    this.saveState();
                    this.showSetupScreen();
                }
            });
        }
        
        const handleBack = () => {
            // Just close the modal — the user stays on the current page
            this.closeModal();
        };

        const storeBackBtn = document.getElementById('rpgStoreBackBtn');
        if(storeBackBtn) storeBackBtn.addEventListener('click', () => this.toggleStore());

        const goBack1 = document.getElementById('rpgGoBackBtn');
        if(goBack1) goBack1.addEventListener('click', handleBack);

        const goBack2 = document.getElementById('rpgStoreGoBackBtn');
        if(goBack2) goBack2.addEventListener('click', handleBack);

        document.querySelectorAll('.store-buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const cost = parseInt(e.currentTarget.dataset.cost);
                const name = e.currentTarget.dataset.name;
                this.purchaseItem(id, cost, name);
            });
        });

        const simBtn = document.getElementById('rpgSimulateBtn');
        if(simBtn) simBtn.addEventListener('click', () => this.runDualSimulation());

        document.querySelectorAll('.skill-node').forEach(node => {
            node.addEventListener('click', (e) => this.viewSkill(e.currentTarget.id));
        });

        document.querySelectorAll('.decision-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const stat = e.currentTarget.dataset.stat;
                const xp = parseInt(e.currentTarget.dataset.xp);
                this.makeDecision(stat, xp);
            });
        });
    }

    openModal() {
        this.modal.classList.add('active');
        if (this.state.designation) {
            this.processDailyLogin();
        }
        this.refreshUI();
    }

    closeModal() {
        this.modal.classList.remove('active');
    }

    showSetupScreen() { this.setupScreen.style.display = 'flex'; this.mainContent.style.display = 'none'; }
    hideSetupScreen() { this.setupScreen.style.display = 'none'; this.mainContent.style.display = 'grid'; }

    async awakenPlayer() {
        const val = this.designationInput.value.trim();
        if(!val) return;
        // V17: Get selected career path
        const pathEl = document.querySelector('input[name="careerPath"]:checked');
        if(!pathEl) { this.showSystemNotification('Path Required', 'Choose Tech or Non-Tech path.', false); return; }
        this.state.careerPath = pathEl.value;
        this.state.designation = val;
        this.state.lastLoginDate = new Date().toDateString();
        this.state.streakDays = 1;
        this.verifyBossScaling();
        this.saveState();
        this.hideSetupScreen();
        this.setMentorMessage("login");
        
        this.awakenBtn.disabled = true;
        this.awakenBtn.textContent = "SYSTEM LOADING...";
        
        await this.generateDailyQuests();
        
        this.awakenBtn.disabled = false;
        this.awakenBtn.textContent = "Awaken System";
        
        this.refreshUI();
        this.showSystemNotification("Awakening Complete", `AI Directives Engaged.`, true);
    }

    verifyBossScaling() {
        if (!this.state.bossMaxHP || this.state.bossMaxHP < 1000) {
            this.state.bossMaxHP = 1000 * this.state.level;
            this.state.bossHP = this.state.bossMaxHP;
        }
    }

    async processDailyLogin() {
        const today = new Date().toDateString();
        if (!this.state.lastLoginDate) {
            this.state.lastLoginDate = today; this.state.streakDays = 1;
            this.setMentorMessage("login"); 
            await this.generateDailyQuests(); 
            this.saveState(); 
            return;
        }

        if (this.state.lastLoginDate !== today) {
            const lastDate = new Date(this.state.lastLoginDate);
            const diffTime = Math.abs(new Date(today) - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                if (this.activeQuests.length > 0) this.invokeDailyPenalty(diffDays);
                else this.state.streakDays += 1;
            } else if (diffDays > 1) {
                this.invokeDailyPenalty(diffDays);
            }

            this.state.lastLoginDate = today;
            this.setMentorMessage("login");
            await this.generateDailyQuests();
            this.saveState();
            this.refreshUI();
        } else {
            this.startTimers();
        }
    }

    invokeDailyPenalty(daysMissed) {
        this.state.streakDays = 0;
        this.state.missedTasks += this.activeQuests.length;
        const xpLoss = 50 * daysMissed; const conLoss = 5 * daysMissed;
        this.addXP(-xpLoss);
        this.state.consistency = Math.max(1, this.state.consistency - conLoss);
        this.state.honor = Math.max(0, this.state.honor - (10 * daysMissed));
        this.showSystemNotification("⚠️ TARDINESS PENALTY", `Streak broken. -${xpLoss}XP, -${conLoss} CON`);
        this.setMentorMessage("failure");
    }

    setMentorMessage(type) {
        if (!this.mentorText) return;
        const quotes = this.mentorQuotes[type];
        this.mentorText.textContent = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;
    }

    // V4 Exponential XP Formula
    getMaxXP() { return Math.floor(100 * Math.pow(this.state.level, 1.5)); }

    getTitle() {
        let currentTitle = "E-Rank Trainee";
        const levels = Object.keys(this.levelTitles).map(Number).sort((a,b)=>a-b);
        for(let l of levels) if(this.state.level >= l) currentTitle = this.levelTitles[l];
        return currentTitle;
    }

    addXP(amount, silent = false) {
        this.state.xp += amount;
        let leveledUp = false;
        
        while(this.state.xp >= this.getMaxXP()) {
            this.state.xp -= this.getMaxXP();
            this.state.level++;
            leveledUp = true;
        }
        if (this.state.xp < 0) {
            this.state.level = Math.max(1, this.state.level - 1);
            this.state.xp = 0;
        }

        if(!silent) {
            if (amount > 0) this.spawnFloatingText(`+${amount} XP`, 'positive');
            else if (amount < 0) this.spawnFloatingText(`${amount} XP`, 'negative');
        }

        this.saveState();
        this.refreshUI();
        
        if(leveledUp) {
            this.showSystemNotification("Level Up!", `Level ${this.state.level}. Boss HP Increased.`, true);
            this.setMentorMessage("levelUp");
            // V4 Boss Scaling
            this.state.bossMaxHP = 1000 * this.state.level;
            this.state.bossHP = this.state.bossMaxHP;
        }
    }

    addStat(statName, amount) {
        if(this.state[statName] !== undefined) {
            this.state[statName] += amount;
            this.saveState();
        }
    }

    spawnFloatingText(text, type) {
        const div = document.createElement('div');
        div.className = `xp-float ${type}`;
        div.textContent = text;
        div.style.left = '50%';
        div.style.top = '50%';
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 1000);
    }

    refreshUI() {
        if(!this.modal || !this.state.designation) return;
        
        this.lvlText.textContent = `LVL ${this.state.level}`;
        this.titleText.textContent = this.getTitle();
        
        // V17: Show career path in class text and dashboard title
        const pathLabel = this.state.careerPath === 'tech' ? '💻 TECH' : '🎯 NON-TECH';
        this.classText.textContent = `${pathLabel} — ${this.state.designation}`;
        
        // Update the icon to hide any old badges (if any)
        const iconBtn = document.getElementById('rpgOpenBtn');
        if (iconBtn) {
            const oldBadge = iconBtn.querySelector('.rpg-path-badge');
            if (oldBadge) oldBadge.remove();
        }
        
        const maxXP = this.getMaxXP();
        const xpPercent = Math.min(100, Math.max(0, (this.state.xp / maxXP) * 100));
        this.xpBar.style.width = `${xpPercent}%`;
        this.xpText.textContent = `${this.state.xp} / ${maxXP} XP`;

        this.coinsVal.textContent = this.state.coins;
        this.honorVal.textContent = this.state.honor;
        if(this.streakVal) this.streakVal.textContent = `${this.state.streakDays}🔥`;

        const MAX_STAT = 200;
        for(const [stat, val] of Object.entries(this.statBars)) {
            const currentVal = this.state[stat];
            this.statVals[stat].textContent = currentVal;
            val.style.width = `${Math.min(100, (currentVal / MAX_STAT) * 100)}%`;
        } 

        if (this.bossHpFill) {
            const maxHp = this.state.bossMaxHP || 1000;
            const hpPct = Math.max(0, (this.state.bossHP / maxHp) * 100);
            this.bossHpFill.style.width = `${hpPct}%`;
            this.bossHpText.textContent = `${this.state.bossHP} / ${maxHp}`;
            
            if (this.state.bossHP <= 0) {
                this.btnAttack.textContent = "DEFEATED (RESPAWNS TMRW)";
                this.btnAttack.disabled = true;
                this.bossHpFill.style.width = "0%";
            } else if (this.activeQuests.length > 0) {
                this.btnAttack.disabled = true;
                this.btnAttack.textContent = "CLEAR QUESTS TO ATTACK";
            } else {
                this.btnAttack.disabled = false;
                this.btnAttack.textContent = "ATTACK BOSS";
            }
        }

        this.state.skillsUnlocked.forEach(sId => {
            const node = document.getElementById(sId);
            if(node) node.classList.add('node-active');
        });

        // Update Store buttons based on unlocked features
        document.querySelectorAll('.store-buy-btn').forEach(btn => {
            const id = btn.dataset.id;
            if (this.state.unlockedFeatures.includes(id)) {
                btn.textContent = "UNLOCKED";
                btn.classList.add('unlocked');
                btn.disabled = true;
            } else if (this.state.coins < parseInt(btn.dataset.cost)) {
                btn.disabled = true;
            } else {
                btn.disabled = false;
            }
        });
    }

    async generateDailyQuests() {
        if(this.state.bossHP <= 0) {
            this.state.bossMaxHP = 1000 * this.state.level;
            this.state.bossHP = this.state.bossMaxHP; 
        }

        const xpMult = 1 + (this.state.level * 0.1); 
        this.questContainer.innerHTML = '<div style="color:#f59e0b; padding:20px; text-align:center; font-style:italic;">VarGo System AI is processing your class directives...</div>';

        // V17: Different prompts for Tech vs Non-Tech paths
        const isTech = this.state.careerPath === 'tech';
        const pathContext = isTech
            ? `The user is on a TECHNICAL career path as a "${this.state.designation}". Tasks should involve coding, system design, debugging, data structures, algorithms, APIs, databases, or technical tool mastery.`
            : `The user is on a NON-TECHNICAL career path as a "${this.state.designation}". Tasks should involve communication, presentation, leadership, negotiation, writing, networking, client management, strategic thinking, or soft skill development.`;

        const prompt = `You are the strict System Administrator for a Solo Leveling inspired progression app.
${pathContext}
Assign 2 specific, actionable daily tasks for them to perform today that genuinely align with their target class.
Task 1 should be a "Hard" core ${isTech ? 'technical/execution' : 'strategic/leadership'} task (e.g. ${isTech ? 'build X, solve Y' : 'write a proposal, lead a mock meeting'}).
Task 2 should be a "Soft/System" improvement task (e.g. ${isTech ? 'study X, review Y, focus block' : 'read about Y, practice public speaking, network'}).

Return ONLY a valid JSON array of exactly 2 objects containing exactly these keys. No markdown.
Example format:
[{"title": "${isTech ? 'Implement JWT Auth in Node' : 'Write a 500-word thought leadership article'}", "stat": "${isTech ? 'intelligence' : 'communication'}", "val": 3, "rank": "B"}, {"title": "${isTech ? 'Read 1 System Design article' : 'Practice 5-minute elevator pitch'}", "stat": "focus", "val": 2, "rank": "C"}]

Allowed stats: intelligence, ambition, consistency, focus, communication.`;

        let qBank = [];

        try {
            const response = await fetch(`${API_BASE_URL}/vargo_chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: prompt })
            });

            if(!response.ok) throw new Error("AI Backend Offline.");

            const data = await response.json();
            let rawJson = data.response;
            
            // Clean AI Output if it contains markdown formatting
            if (rawJson.includes('\`\`\`json')) {
                rawJson = rawJson.split('\`\`\`json')[1].split('\`\`\`')[0].trim();
            } else if (rawJson.includes('\`\`\`')) {
                rawJson = rawJson.split('\`\`\`')[1].split('\`\`\`')[0].trim();
            }
            
            const aiTasks = JSON.parse(rawJson);
            
            if (aiTasks[0]) qBank.push({ id: Date.now() + 1, title: `[Daily] ${aiTasks[0].title}`, type: "Daily", rank: aiTasks[0].rank || "B", xp: Math.floor(60 * xpMult), coins: 20, stat: aiTasks[0].stat || "intelligence", val: aiTasks[0].val || 3, timeLimit: 14400 });
            if (aiTasks[1]) qBank.push({ id: Date.now() + 2, title: `[Side] ${aiTasks[1].title}`, type: "Side", rank: aiTasks[1].rank || "C", xp: Math.floor(30 * xpMult), coins: 10, stat: aiTasks[1].stat || "focus", val: aiTasks[1].val || 2, timeLimit: 7200 });

        } catch (e) {
            console.error("AI Quest Gen Error. Using static fallbacks.", e);
            qBank.push({ id: Date.now() + 1, title: "[Daily] System Offline: Complete 1 Project Feature", type: "Daily", rank: "C", xp: Math.floor(50 * xpMult), coins: 15, stat: "intelligence", val: 3, timeLimit: 14400 });
            qBank.push({ id: Date.now() + 2, title: "[Side] Focus Block: 2 Hours Deep Work", type: "Side", rank: "E", xp: Math.floor(25 * xpMult), coins: 5, stat: "focus", val: 2, timeLimit: 7200 });
        }

        if (this.state.streakDays >= 3) {
            qBank.push({ id: Date.now() + 3, title: "SECRET: The Abyss Evaluates You", type: "Hidden", rank: "HIDDEN", xp: Math.floor(150 * xpMult), coins: 50, stat: "ambition", val: 5, timeLimit: 3600 });
        }

        this.activeQuests = qBank;
        this.saveState();
        this.renderQuests();
        this.startTimers();
    }

    renderQuests() {
        if(!this.questContainer) return;
        this.questContainer.innerHTML = '';
        
        if (this.activeQuests.length === 0) {
            this.questContainer.innerHTML = '<div style="color:#64748b; font-size:0.9rem; text-align:center; padding:20px;">All daily tasks cleared. You may attack the Boss.</div>';
            return;
        }
        
        this.activeQuests.forEach(q => {
            const div = document.createElement('div');
            div.className = `quest-item diff-${q.rank} ${q.rank === 'HIDDEN' ? 'hidden-quest' : ''}`;
            div.id = `quest-${q.id}`;
            div.innerHTML = `
                <div class="quest-info">
                    <h4><span class="quest-rank rank-${q.rank}">[${q.rank}]</span> ${q.title}</h4>
                    <div class="quest-meta">
                        <span class="quest-rewards">+${q.xp}XP / +${q.coins}🪙</span>
                        <span>+${q.val} ${q.stat.substring(0,3).toUpperCase()}</span>
                    </div>
                </div>
                <div class="quest-actions">
                    <div class="quest-timer" id="timer-${q.id}">--:--</div>
                    <button class="btn-complete" id="btn-comp-${q.id}">Perform Task</button>
                </div>
            `;
            this.questContainer.appendChild(div);
            document.getElementById(`btn-comp-${q.id}`).addEventListener('click', () => { this.handleQuestCompletion(q.id); });
        });
        this.updateTimerDisplays();
    }

    startTimers() {
        if (this.questTimerInterval) clearInterval(this.questTimerInterval);
        this.questTimerInterval = setInterval(() => {
            let removedAny = false;
            // Iterate backwards so splicing doesn't mess up indices
            for (let i = this.activeQuests.length - 1; i >= 0; i--) {
                const q = this.activeQuests[i];
                q.timeLimit -= 1;
                if (q.timeLimit <= 0) {
                    this.failQuest(q.id, "Time Expired");
                    removedAny = true;
                }
            }
            if (!removedAny) {
                this.updateTimerDisplays();
            }
            this.saveState();
        }, 1000);
    }

    updateTimerDisplays() {
        this.activeQuests.forEach(q => {
            const timerEl = document.getElementById(`timer-${q.id}`);
            if (timerEl) {
                const h = Math.floor(q.timeLimit / 3600);
                const m = Math.floor((q.timeLimit % 3600) / 60);
                const s = q.timeLimit % 60;
                timerEl.textContent = h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                if (q.timeLimit <= 300) timerEl.classList.add('urgent');
            }
        });
    }    // V6 Dynamic Task Playground Engine
    handleQuestCompletion(questId) {
        const qIndex = this.activeQuests.findIndex(q => q.id === questId);
        if (qIndex === -1) return;
        const q = this.activeQuests[qIndex];

        const mainContent = document.getElementById('rpgMainContent');
        const playground = document.getElementById('rpgPlaygroundScreen');
        
        // Hide dashboard
        mainContent.style.display = 'none';
        
        // Build Dynamic UI based on quest stat
        let pgHtml = '';
        let themeClass = '';

        if (q.stat === 'intelligence' || q.stat === 'ambition') {
            // Code Matrix
            themeClass = 'pg-code';
            pgHtml = `
                <div class="pg-header">
                    <div class="pg-title"><span style="color:#38bdf8;">[THE MATRIX]</span> ${q.title}</div>
                    <div class="pg-desc">// Code Execution Environment. Paste your implementation below.</div>
                </div>
                <div class="pg-editor">
                    <div class="pg-gutter">1<br>2<br>3<br>4<br>5</div>
                    <textarea class="pg-input" id="pgInput" placeholder="function hackThePlanet() { ... }"></textarea>
                </div>
            `;
        } else if (q.stat === 'focus' || q.stat === 'consistency') {
            // Zen Writer
            themeClass = 'pg-zen';
            pgHtml = `
                <div class="pg-header">
                    <div class="pg-title">The Focus Chamber</div>
                    <div class="pg-desc">Reflect heavily on: ${q.title}</div>
                </div>
                <div class="pg-editor">
                    <textarea class="pg-input" id="pgInput" placeholder="Begin your reflection..." style="font-family:'Georgia', serif; font-size:1.1rem; line-height:1.6; padding:30px; border:none;"></textarea>
                </div>
            `;
        } else {
            // Ops Terminal (comm/project links)
            themeClass = 'pg-terminal';
            pgHtml = `
                <div class="pg-header">
                    <div class="pg-title">MISSION CONTROL: ${q.title}</div>
                    <div class="pg-desc">>_ Awaiting secure URL / PR / Submission link...</div>
                </div>
                <div class="pg-editor" style="display:flex; flex-direction:column; justify-content:center;">
                    <div style="color:#10b981; font-family:monospace; margin-bottom:10px;">root@system:~# Provide Output</div>
                    <input type="text" class="pg-input" id="pgInput" placeholder="https://..." style="min-height:40px; border-bottom:2px solid #10b981;"></input>
                </div>
            `;
        }

        playground.className = `pg-screen ${themeClass}`;
        playground.innerHTML = `
            ${pgHtml}
            <div class="pg-actions">
                <button class="pg-btn pg-cancel" id="pgBtnCancel">ABORT MISSION</button>
                <button class="pg-btn pg-submit" id="pgBtnSubmit">SUBMIT TO SYSTEM AI</button>
            </div>
            <div id="aiLoadingStatus" style="display:none; color:#f59e0b; margin-top:20px; font-size:1rem; text-align:center; font-family:monospace; font-weight:bold; animation: pulseAttr 1s infinite alternate;">SYSTEM AI EVALUATING PROOF...</div>
        `;
        
        playground.style.display = 'flex';

        // Bind playground buttons
        document.getElementById('pgBtnCancel').addEventListener('click', () => {
            playground.style.display = 'none';
            playground.innerHTML = '';
            mainContent.style.display = 'grid';
        });

        document.getElementById('pgBtnSubmit').addEventListener('click', async () => {
            const inputEl = document.getElementById('pgInput');
            const text = inputEl.value.trim();
            if(!text) {
                this.showSystemNotification("Evaluation Failed", "You must provide proof of work.", false);
                return;
            }

            const btnSubmit = document.getElementById('pgBtnSubmit');
            const btnCancel = document.getElementById('pgBtnCancel');
            const loadingText = document.getElementById('aiLoadingStatus');
            
            btnSubmit.disabled = true; btnCancel.disabled = true;
            inputEl.disabled = true;
            loadingText.style.display = 'block';

            try {
                const result = await this.evaluateTaskWithVarGo(q.title, text);
                
                if (result.passed) {
                    this.showSystemNotification("Task Approved", "VarGo accepted your proof.", true);
                    playground.style.display = 'none';
                    playground.innerHTML = '';
                    mainContent.style.display = 'grid';
                    this.rewardQuest(q, qIndex);
                } else {
                    this.showSystemNotification("Task Rejected", result.reason || "Proof insufficient.", false);
                    playground.style.display = 'none';
                    playground.innerHTML = '';
                    mainContent.style.display = 'grid';
                    this.failQuest(q.id, result.reason || "Failed VarGo Evaluation"); // Penalty for lying to the System
                }
            } catch (err) {
                console.error("AI Evaluation error:", err);
                loadingText.style.display = 'none';
                btnSubmit.disabled = false; btnCancel.disabled = false;
                inputEl.disabled = false;
                this.showSystemNotification("System Error", "VarGo is unreachable. Try again.", false);
            }
        });
    }

    async evaluateTaskWithVarGo(questTitle, userInput) {
        // Build the strict AI prompt
        const prompt = `You are VarGo, the strict strict System AI for a Solo Leveling inspired progression app.
The user was assigned the task: "${questTitle}".
Here is their submitted proof of work:
"${userInput}"

Did the user satisfactorily complete the task described? Do their actions/proof align with what was requested?
Respond ONLY with 'YES' or 'NO', followed by a single sentence explaining your judgment. Remember, if they claim they did something but provide no proof or a nonsense answer, say NO.`;

        const response = await fetch(`${API_BASE_URL}/vargo_chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: prompt })
        });

        if (!response.ok) throw new Error("API Network Error");
        const data = await response.json();
        
        // Expected response format: "YES. Your code correctly integrates the API."
        const reply = data.response.trim();
        const upperReply = reply.toUpperCase();
        
        if (upperReply.startsWith("YES")) {
            return { passed: true, reason: reply.substring(3).trim() };
        } else {
            return { passed: false, reason: reply.startsWith("NO") ? reply.substring(2).trim() : reply };
        }
    }

    rewardQuest(q, index) {
        // Safe check to ensure we don't duplicate remove
        const actualIndex = this.activeQuests.findIndex(aq => aq.id === q.id);
        if (actualIndex > -1) this.activeQuests.splice(actualIndex, 1);
        
        this.addStat(q.stat, q.val);
        if (q.rank === "HIDDEN") this.addStat("ambition", 5);
        this.addStat("consistency", 1);
        this.addXP(q.xp);
        this.state.coins += q.coins;
        this.state.questsCompleted++;
        
        this.renderQuests();
        this.saveState();
        this.refreshUI();
        this.showSystemNotification("Validation Succeeded", "Rewards Granted.", true);
        
        // V16: Log quest completion to progress dashboard
        if (window.logActivity) {
            logActivity('career_rpg', `Completed Quest: ${q.title}`, `+${q.xp}XP +${q.coins}coins • Level ${this.state.level}`);
        }
    }

    failQuest(questId, penaltyReason = "Time Expired") {
        const qIndex = this.activeQuests.findIndex(q => q.id === questId);
        if (qIndex === -1) return;
        
        // Purge the failed quest
        this.activeQuests.splice(qIndex, 1);
        
        this.state.missedTasks++;
        this.state.consistency = Math.max(1, this.state.consistency - 5);
        this.state.focus = Math.max(1, this.state.focus - 2);
        this.state.honor -= 10;
        this.addXP(-20);
        this.setMentorMessage("failure");
        
        if (penaltyReason === "Time Expired") {
            this.showSystemNotification("⚠️ Time Expired", "Behavior documented. Stats reduced.", false);
        } else {
            this.showSystemNotification("❌ Task Failed", `${penaltyReason}. Stats reduced.`, false);
        }
        
        // Re-render because the array shrunk
        this.renderQuests();
        this.refreshUI();
    }

    // V4 Boss RNG Combat
    attackBoss() {
        if (this.state.bossHP <= 0 || this.activeQuests.length > 0) return;
        
        const baseDmg = this.state.intelligence * 2 + this.state.focus * 3;
        const roll = Math.random();

        if (roll < 0.10) {
            // CRITICAL HIT
            const dmg = baseDmg * 2;
            this.state.bossHP -= dmg;
            this.addXP(100, true);
            this.spawnFloatingText(`CRIT! -${dmg} DMG`, 'crit');
            this.showSystemNotification("CRITICAL STRIKE", "Massive damage dealt!", true);
        } else if (roll < 0.30) {
            // MISS
            this.spawnFloatingText(`MISS`, 'miss');
            this.showSystemNotification("Attack Missed", "The Boss evaded your logic.", false);
        } else if (roll < 0.45) {
            // COUNTER-ATTACK
            this.state.honor = Math.max(0, this.state.honor - 5);
            this.addXP(-20, true);
            this.spawnFloatingText(`COUNTERED -20XP`, 'negative');
            this.showSystemNotification("⚠️ Counter-Attack", "The Boss overwhelmed your logic. -20 XP", false);
        } else {
            // NORMAL HIT
            this.state.bossHP -= baseDmg;
            this.addXP(30, true);
            this.spawnFloatingText(`-${baseDmg} DMG`, 'positive');
        }
        
        if (this.state.bossHP <= 0) {
            this.state.bossHP = 0;
            this.showSystemNotification("BOSS DEFEATED", "The Burnout Demon falls. +500 XP!", true);
            this.addXP(500);
            this.state.coins += 200;
            // V16: Log boss defeat to progress dashboard
            if (window.logActivity) {
                logActivity('career_rpg', `Defeated Boss at Level ${this.state.level}!`, `+500XP +200coins • ${this.getTitle()}`);
            }
        }
        
        this.saveState();
        this.refreshUI();
    }

    // V7 THE EXCHANGE DYNAMICS
    toggleStore() {
        const mc = document.getElementById('rpgMainContent');
        const st = document.getElementById('rpgStoreScreen');
        const pg = document.getElementById('rpgPlaygroundScreen'); // Assuming playground might be open
        if (mc.style.display !== 'none') {
            mc.style.display = 'none';
            pg.style.display = 'none'; // Close playground if open
            st.style.display = 'flex';
        } else {
            st.style.display = 'none';
            mc.style.display = 'grid';
        }
    }

    purchaseItem(id, cost, name) {
        if (this.state.coins < cost) {
            this.showSystemNotification("Insufficient Funds", `You need ${cost} Coins.`, false);
            return;
        }
        if (this.state.unlockedFeatures.includes(id)) return;

        this.state.coins -= cost;
        this.state.unlockedFeatures.push(id);
        
        this.showSystemNotification("Purchase Successful", `${name} Unlocked.`, true);
        this.saveState();
        this.refreshUI();
        
        // Grant Golden Badge instantly
        if (id === 'premium_pass') {
            this.showSystemNotification("Premium Activated", "Golden Nameplate achieved.", true);
            const pName = document.querySelector('.player-name');
            if(pName) pName.style.color = '#fbbf24';
        }
    }

    runDualSimulation() {
        const btn = document.getElementById('rpgSimulateBtn');
        btn.innerHTML = "⏳ Scanning Timelines..."; btn.disabled = true;
        setTimeout(() => {
            btn.style.display = 'none';
            const resultArea = document.getElementById('dualSimResult'); resultArea.style.display = 'grid';
            const baseSal = 500000;
            const totalStats = this.state.intelligence + this.state.consistency + this.state.focus + this.state.communication + this.state.ambition;
            const pSal = baseSal + ((totalStats + 50) * 15000) + (this.state.level * 50000);
            document.getElementById('sim-pos-role').textContent = "Lead " + (this.state.designation || "Engineer");
            document.getElementById('sim-pos-salary').textContent = "₹" + (pSal / 100000).toFixed(1) + " LPA";
            document.getElementById('sim-pos-stress').textContent = "Manageable"; document.getElementById('sim-pos-growth').textContent = "High";
            const nSal = baseSal + (totalStats * 5000) - (this.state.missedTasks * 20000);
            const negSal = Math.max(300000, nSal);
            document.getElementById('sim-neg-role').textContent = "Stuck " + (this.state.designation || "Engineer");
            document.getElementById('sim-neg-salary').textContent = "₹" + (negSal / 100000).toFixed(1) + " LPA";
            document.getElementById('sim-neg-stress').textContent = "Severe / Burned Out"; document.getElementById('sim-neg-growth').textContent = "Stagnant";
            resultArea.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 2000);
    }

    makeDecision(statToIncrease, xpCost) {
        if(this.state.xp < xpCost && this.state.level == 1) { this.showSystemNotification("Insufficient XP", "Action aborted."); return; }
        this.addXP(-xpCost, true);
        const statMap = { "int": "intelligence", "con": "consistency", "foc": "focus" };
        const actualStatName = statMap[statToIncrease] || statToIncrease;
        this.addStat(actualStatName, 5);
        if (actualStatName === "consistency") this.addStat("ambition", -2);
        this.showSystemNotification("Decision Registered", `+5 ${actualStatName.toUpperCase()}`, true);
        this.refreshUI();
    }

    viewSkill(nodeId) {
        let name = "Unknown Skill"; let desc = "Locked."; let cost = 999;
        if (nodeId === 'node-1') { name = "Deep Work Protocol"; desc = "+20% Focus gains globally."; cost = 50; }
        if (nodeId === 'node-2') { name = "Algorithms Awakened"; desc = "Unlock Advanced coding quests."; cost = 100; }
        if (nodeId === 'node-3') { name = "Domain Expansion"; desc = "Double XP from Boss attacks."; cost = 250; }
        const info = document.getElementById('skillInfoArea');
        info.innerHTML = `
            <div class="skill-name">${name}</div><div class="skill-desc">${desc}</div>
            ${this.state.skillsUnlocked.includes(nodeId) ? `<div style="color:#34d399; font-size:0.8rem; margin-top:5px; font-weight:700;">UNLOCKED</div>` : `<button class="btn-unlock" id="btnUnlockSkill" data-node="${nodeId}" data-cost="${cost}">Unlock (${cost} 🪙)</button>`}
        `;
        const btn = document.getElementById('btnUnlockSkill');
        if(btn) btn.addEventListener('click', (e) => this.unlockSkill(e.currentTarget));
    }

    unlockSkill(btn) {
        const cost = parseInt(btn.dataset.cost); const node = btn.dataset.node;
        if (this.state.coins >= cost) {
            this.state.coins -= cost; this.state.skillsUnlocked.push(node);
            this.saveState(); this.refreshUI(); this.viewSkill(node);
            this.showSystemNotification("Skill Unlocked", "Constellation activated.", true);
        } else { this.showSystemNotification("Insufficient Coins", "Quest more."); }
    }

    showSystemNotification(title, message, isSuccess = false) {
        const div = document.createElement('div');
        div.className = `sys-notification ${isSuccess ? 'success' : ''}`;
        div.innerHTML = `<div class="sys-title"><span class="sys-sys">[System]</span> ${title}</div><div class="sys-message">${message}</div>`;
        document.body.appendChild(div);
        setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity 0.5s'; setTimeout(() => div.remove(), 500); }, 3000);
    }
}

// Ensure init
const rpgModalHTML = `
<!-- Trigger Button (V17: Circular icon) -->
<div class="rpg-button-container">
    <button class="rpg-toggle" id="rpgOpenBtn" title="System V4">
        <span class="rpg-icon">⚔️</span>
    </button>
</div>

<!-- Modal -->
<div class="rpg-modal-overlay" id="rpgModal">
    <div class="rpg-dashboard">
        <div class="rpg-header">
            <div class="rpg-title">⚔️ SYSTEM STATUS HUB</div>
            <div style="display:flex; gap:10px;">
                <button class="rpg-exchange-btn" id="rpgSwitchPathBtn" style="background:#7c3aed; border-color:#8b5cf6; color:white; font-size:0.7rem;" title="Switch Career Path">🔄 SWITCH PATH</button>
                <button class="rpg-exchange-btn" id="rpgGoBackBtn" style="background:#475569; border-color:#64748b; color:white;">⬅ BACK</button>
                <button class="rpg-exchange-btn" id="rpgExchangeBtn">🛒 THE EXCHANGE</button>
                <button class="rpg-close-btn" id="rpgCloseBtn">✕</button>
            </div>
        </div>

        <!-- Setup Screen (V17: Path Selection) -->
        <div id="rpgSetupScreen">
            <h1 class="setup-title">Awaken Your Potential</h1>
            <p class="setup-sub">Choose your career path and designate your target class.</p>
            
            <div style="display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; justify-content: center;">
                <label style="cursor:pointer; flex:1; min-width:200px; max-width:280px;">
                    <input type="radio" name="careerPath" value="tech" style="display:none;" id="pathTech">
                    <div style="background: rgba(99,102,241,0.08); border: 2px solid rgba(99,102,241,0.2); border-radius: 16px; padding: 24px 20px; text-align: center; transition: all 0.3s;" id="cardTech" onmouseover="this.style.borderColor='rgba(99,102,241,0.5)'" onmouseout="if(!document.getElementById('pathTech').checked) this.style.borderColor='rgba(99,102,241,0.2)'">
                        <div style="font-size: 2.5rem; margin-bottom: 10px;">💻</div>
                        <div style="font-size: 1.1rem; font-weight: 700; color: #818cf8;">Technical Path</div>
                        <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 6px;">Coding • DSA • System Design<br>APIs • Databases • DevOps</div>
                    </div>
                </label>
                <label style="cursor:pointer; flex:1; min-width:200px; max-width:280px;">
                    <input type="radio" name="careerPath" value="nontech" style="display:none;" id="pathNonTech">
                    <div style="background: rgba(236,72,153,0.08); border: 2px solid rgba(236,72,153,0.2); border-radius: 16px; padding: 24px 20px; text-align: center; transition: all 0.3s;" id="cardNonTech" onmouseover="this.style.borderColor='rgba(236,72,153,0.5)'" onmouseout="if(!document.getElementById('pathNonTech').checked) this.style.borderColor='rgba(236,72,153,0.2)'">
                        <div style="font-size: 2.5rem; margin-bottom: 10px;">🎯</div>
                        <div style="font-size: 1.1rem; font-weight: 700; color: #ec4899;">Non-Technical Path</div>
                        <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 6px;">Leadership • Communication<br>Strategy • Networking • Writing</div>
                    </div>
                </label>
            </div>

            <input type="text" id="optDesignation" class="setup-input" placeholder="e.g. Product Manager, ML Engineer, Marketing Lead" autocomplete="off">
            <button class="btn-awaken" id="btnAwaken">Awaken System</button>
        </div>

        <!-- Main Content -->
        <div class="rpg-content" id="rpgMainContent" style="display:none;">
            
            <!-- Left Panel -->
            <div class="rpg-profile-panel">
                <div class="rpg-card">
                    <div class="player-avatar">👤</div>
                    <div class="player-name">PLAYER</div>
                    <div class="player-class" id="rpgClassText">CLASS: UNKNOWN</div>
                    <div class="level-info"><span id="rpgTitleText">E-RANK TRAINEE</span></div>
                    
                    <div class="status-grid">
                        <div class="status-box"><div class="status-label">Coins</div><div class="status-val val-gold" id="rpgValCoins">0</div></div>
                        <div class="status-box"><div class="status-label">Honor</div><div class="status-val val-honor" id="rpgValHonor">100</div></div>
                        <div class="status-box"><div class="status-label">Streak</div><div class="status-val val-streak" id="rpgValStreak">0🔥</div></div>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <div class="level-info" style="font-size:0.9rem;" id="rpgLvlText">LVL 1</div>
                        <div class="xp-bar-container"><div class="xp-bar-fill" id="rpgXpBar"></div></div>
                        <div class="xp-text" id="rpgXpText">0 / 100 XP</div>
                    </div>

                    <div class="section-title">Attributes</div>
                    <div class="stat-row"><div class="stat-header"><span>Intelligence</span><span id="rpg-val-int">10</span></div><div class="stat-bar-bg"><div class="stat-bar-fill stat-int" id="rpg-stat-int"></div></div></div>
                    <div class="stat-row"><div class="stat-header"><span>Consistency</span><span id="rpg-val-con">10</span></div><div class="stat-bar-bg"><div class="stat-bar-fill stat-con" id="rpg-stat-con"></div></div></div>
                    <div class="stat-row"><div class="stat-header"><span>Focus</span><span id="rpg-val-foc">10</span></div><div class="stat-bar-bg"><div class="stat-bar-fill stat-foc" id="rpg-stat-foc"></div></div></div>
                    <div class="stat-row"><div class="stat-header"><span>Communication</span><span id="rpg-val-com">10</span></div><div class="stat-bar-bg"><div class="stat-bar-fill stat-com" id="rpg-stat-com"></div></div></div>
                    <div class="stat-row"><div class="stat-header"><span>Ambition</span><span id="rpg-val-amb">10</span></div><div class="stat-bar-bg"><div class="stat-bar-fill stat-amb" id="rpg-stat-amb"></div></div></div>
                </div>
            </div>

            <!-- Center Panel -->
            <div class="rpg-main-panel">
                <div class="mentor-message-box">
                    <div class="mentor-icon">🔮</div>
                    <div>
                        <div class="mentor-text" id="mentorMessageText">"Loading System Metrics..."</div>
                        <div class="mentor-author">SYSTEM ADMINISTRATOR</div>
                    </div>
                </div>

                <div class="rpg-card">
                    <div class="section-title">⚔️ Daily Directives</div>
                    <div class="quest-list" id="rpgQuestList"></div>
                </div>

                <div class="rpg-card simulator-area">
                    <button class="btn-simulate" id="rpgSimulateBtn">🔮 Simulate Dual Pathways</button>
                    <div id="dualSimResult">
                        <div class="path-card path-positive">
                            <div class="path-title">Path of Discipline</div>
                            <div class="sim-row">Predicted Role: <span id="sim-pos-role">--</span></div>
                            <div class="sim-row">Est. Salary: <span id="sim-pos-salary" style="color:#34d399;">--</span></div>
                            <div class="sim-row">Stress Level: <span id="sim-pos-stress" style="color:#fbbf24;">--</span></div>
                            <div class="sim-row">Growth Trajectory: <span id="sim-pos-growth" style="color:#38bdf8;">--</span></div>
                        </div>
                        <div class="path-card path-negative">
                            <div class="path-title">Path of Regret</div>
                            <div class="sim-row">Predicted Role: <span id="sim-neg-role">--</span></div>
                            <div class="sim-row">Est. Salary: <span id="sim-neg-salary" style="color:#f87171;">--</span></div>
                            <div class="sim-row">Stress Level: <span id="sim-neg-stress" style="color:#ef4444;">--</span></div>
                            <div class="sim-row">Growth Trajectory: <span id="sim-neg-growth" style="color:#94a3b8;">--</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Panel -->
            <div class="panel-right">
                <div class="boss-card">
                    <div class="boss-title">Weekly Boss: The Burnout Demon</div>
                    <div class="boss-desc">Defeating it requires extreme Intellect and Focus damage. Clear quests to attack.</div>
                    <div class="boss-hp-container">
                        <div class="boss-hp-fill" id="bossHpFill"></div>
                        <div class="boss-hp-text" id="bossHpText">1000/1000</div>
                    </div>
                    <button class="btn-attack" id="btnAttackBoss" disabled>CLEAR QUESTS TO ATTACK</button>
                </div>

                <div class="rpg-card constellation-card">
                    <div class="section-title">✨ Constellations</div>
                    <div class="constellation-wrapper">
                        <div class="node-line line-1-2"></div>
                        <div class="node-line line-2-3"></div>
                        <div class="skill-node" id="node-1">1</div>
                        <div class="skill-node" id="node-2">2</div>
                        <div class="skill-node" id="node-3">3</div>
                    </div>
                    <div class="skill-info" id="skillInfoArea">
                        <div style="font-size:0.8rem; color:#64748b; margin-top:20px;">Click a node to view its power.</div>
                    </div>
                </div>
            </div>

        </div>

        <!-- V6 Dynamic Playground Area -->
        <div id="rpgPlaygroundScreen" style="display:none; width:100%; height:100%; flex-direction:column; padding:30px; box-sizing:border-box;"></div>

        <!-- V7 Store Area -->
        <div id="rpgStoreScreen" style="display:none; width:100%; height:100%; flex-direction:column; padding:30px; box-sizing:border-box;">
            <div class="store-header">
                <h2>THE EXCHANGE</h2>
                <div>Spend System Coins to unlock reality-altering platform features.</div>
                <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                    <button class="pg-btn pg-cancel" id="rpgStoreGoBackBtn" style="padding: 5px 15px; border-color: #64748b; color: #94a3b8;">⬅ PREVIOUS PAGE</button>
                    <button class="pg-btn pg-cancel" id="rpgStoreBackBtn" style="padding: 5px 15px;">BACK TO DASHBOARD</button>
                </div>
            </div>
            <div class="store-grid">
                <!-- Store Item 1 (Premium) -->
                <div class="store-card" style="border-color: #fbbf24; width: 100%; max-width: 400px; margin: 0 auto;">
                    <div class="store-item-title" style="color: #fbbf24;">Premium Pass</div>
                    <div class="store-item-desc">Ultimate subscription. Unlocks all restricted modules and grants the Golden Profile Badge in your dashboard.</div>
                    <div class="store-item-price" style="color: #fbbf24;">1000 🪙</div>
                    <button class="store-buy-btn golden" data-id="premium_pass" data-cost="1000" data-name="Premium Pass">PURCHASE</button>
                </div>
            </div>
        </div>

    </div>
</div>
`;

document.addEventListener('DOMContentLoaded', () => { 
    document.body.insertAdjacentHTML('beforeend', rpgModalHTML);
    
    // Only show the RPG icon if the user is logged in
    const openBtn = document.getElementById('rpgOpenBtn');
    if (openBtn) {
        if (localStorage.getItem('isLoggedIn') !== 'true') {
            openBtn.style.display = 'none';
        }
    }

    window.careerRPGEngineV4 = new CareerRPG(); 
    
    // V7 Feature Locks - REMOVED TO PREVENT REDUCTION IN UX
    // (Previously blocked access to Resume Parser and Expert Chat until unlocked in the RPG)

});
