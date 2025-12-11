// ======================================================
// (2) 메인 스크립트 (firebase_script.js)
// ======================================================

// DOM이 로드되면 게임 초기화
document.addEventListener('DOMContentLoaded', () => {

    // === 1. Constants ===
    const INITIAL_CASH = 5000000;      // 초기 현금
    const MAX_HISTORY_LOG = 100;      // 거래내역 최대 100줄
    const MAX_HISTORY = 30;           // 차트용 데이터 30개
    const FEE_RATE = 0.0075;           // 매매 수수료 (0.75%)
    const TIME_ATTACK_DURATION = 30 * 60; // 30분 (초)
    const DELIST_DURATION_MS = 10 * 60 * 1000; // 상장 폐지 시간 
    let marketUpdateTimer = null;

    // [수정] 실제 주식 이름 20개
    const STOCK_TICKERS = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B', 'V', 'JNJ',
        'XOM', 'JPM', 'TSM', 'NFLX', 'SBUX', 'NKE', 'MCD', 'KO', 'DIS', 'VT',
        'PG', 'WMT', 'COST', 'PEP', 'HD','SEC', 'SKH', 'LGES', 'HYMT', 'NAVER'
    ];
    // 자산 (금, 은, 원유)
    const ASSET_TICKERS = ['GOLD', 'SLVR', 'OIL', 'NGAS', 'COPR', 'WHEAT'];
    // 채권 (미국 장기, 미국 단기)
    const BOND_TICKERS = ['BOND_L', 'BOND_S', 'CORP_B', 'HY_B'];
    // 코인
    const COIN_TICKERS = ['BTC', 'ETH', 'DOGE', 'SOL'];
    // 기타
    const MISC_TICKERS = ['DEV_MOOD', 'SONG', 'COOKIE'];


    // [수정] 모든 티커를 동적으로 결합 (createInitialPlayerState에서 사용)
    const allTickers = [
        ...STOCK_TICKERS, 
        ...ASSET_TICKERS, 
        ...BOND_TICKERS, 
        ...MISC_TICKERS
    ];

    // [수정] 모든 티커의 이름 정의
    const allTickerNames = {
        // --- 주식 (STOCKS) ---
        'AAPL': 'Apple (애플)',
        'MSFT': 'Microsoft (마이크로소프트)',
        'GOOGL': 'Alphabet (구글)',
        'AMZN': 'Amazon (아마존)',
        'NVDA': 'NVIDIA (엔비디아)',
        'META': 'Meta Platforms (메타)',
        'TSLA': 'Tesla (테슬라)',
        'BRK-B': 'Berkshire Hathaway B (버크셔 해서웨이 B)',
        'V': 'Visa (비자)',
        'JNJ': 'Johnson & Johnson (존슨 앤 존슨)',
        'XOM': 'Exxon Mobil (엑슨모빌)',
        'JPM': 'JPMorgan Chase (JP모건 체이스)',
        'TSM': 'TSMC (TSMC)',
        'NFLX': 'Netflix (넷플릭스)',
        'SBUX': 'Starbucks (스타벅스)',
        'NKE': 'Nike (나이키)',
        'MCD': "McDonald's (맥도날드)",
        'KO': 'Coca-Cola (코카콜라)',
        'DIS': 'Disney (디즈니)',
        'VT': 'Vanguard Total World ETF (뱅가드 토탈 월드 ETF)',
        'PG': 'Procter & Gamble (P&G)',
        'WMT': 'Walmart (월마트)',
        'COST': 'Costco (코스트코)',
        'PEP': 'PepsiCo (펩시코)',
        'HD': 'Home Depot (홈디포)',
        'SEC': '삼성전자 (Samsung Elec.)',
        'SKH': 'SK하이닉스 (SK Hynix)',
        'LGES': 'LG에너지솔루션 (LG Energy Solution)',
        'HYMT': '현대자동차 (Hyundai Motor)',
        'NAVER': '네이버 (NAVER)',
        
        // --- 실물자산 (ASSETS) ---
        'GOLD': '금 (Gold)',
        'SLVR': '은 (Silver)',
        'OIL': 'WTI 원유 (Crude Oil)',
        'NGAS': '천연가스 (Natural Gas)',
        'COPR': '구리 (Copper)',
        'WHEAT': '밀 (Wheat)',
        
        // --- 채권 (BONDS) ---
        'BOND_L': '미국 장기채 (US Long Bond)',
        'BOND_S': '미국 단기채 (US Short Bond)',
        'CORP_B': '미국 회사채 (Corp. Bond)',
        'HY_B': '하이일드 채권 (High-Yield)',

        // --- 코인 (COINS) ---
        'BTC': '비트코인 (Bitcoin)',
        'ETH': '이더리움 (Ethereum)',
        'DOGE': '도지코인 (Dogecoin)',
        'SOL': '솔라나 (Solana)',
        
        // --- 기타 (MISC) ---
        'DEV_MOOD': '개발자 무드 (Dev Mood)',
        'SONG': '송송 그룹 (SongSong)',
        'COOKIE': '쿠키 컴퍼니 (CookieCo)'
    };


    // === 2. Global Variables ===
    let state = {};                 // 현재 플레이어의 모든 데이터 (DB 미러링)
    let stockData = {};             // 마켓의 모든 주식 데이터 (DB 미러링)
    let allPlayersData = {};        // [랭킹용] 모든 플레이어 데이터
    
    let currentView = 'stocks';     // 'stocks', 'assets', 'bonds', 'misc'
    let currentTicker = 'AAPL';     // [수정] 기본값을 'AAPL'로
    let currentRankView = 'networth'; // [랭킹용] 'networth' or 'timeattack'
    
    let netWorthRankings = [];      // [랭킹용] 총 자산 랭킹 데이터
    let timeAttackRankings = [];    // [랭킹용] 타임 어택 랭킹 데이터

    let chartInstance = null;
    let authUnsubscribe = null;     // 인증 리스너 해제용
    let playerUnsubscribe = null;   // 플레이어 리스너 해제용
    let marketUnsubscribe = null;   // 마켓 리스너 해제용
    let timeAttackTimer = null;     // 타임어택 타이머 ID
    let isTimeAttackListenerInitialized = false; //재개 알림

    let bankTimer = null; // 은행 이자 타이머

    
    // === 3. DOM Elements (els) ===
    // (HTML 파일의 모든 ID를 여기에 등록)
    const els = {
        // 인증
        authScreen: null,
        googleLoginBtn: null,
        mainGame: null,
        
        // 탭
        showStocksBtn: null,
        showAssetsBtn: null,
        showBondsBtn: null,
        showCoinsBtn: null,
        showMiscBtn: null,
        stockSelector: null,
        
        // 주식 정보
        stockName: null,
        stockTicker: null,
        price: null,
        change: null,
        chart: null,
        
        // 거래
        amount: null, 
        buyBtn: null,
        sellBtn: null,
        buyMaxBtn: null,
        sellAllBtn: null,

        
        // 포트폴리오
        cash: null,
        stockValue: null,
        totalGrossHoldings: null, 
        totalNetWorth: null,  
        portfolioList: null,
        
        // 버튼
        timeAttackBtn: null,
        timeAttackTimerDisplay: null,
        bankBtn: null,
        showRankingModalBtn: null,
        logoutBtn: null,
        
        // 거래 내역
        log: null,
        historyList: null,

        // 알림 모달
        alertModal: null,
        alertMessage: null,
        alertCloseBtn: null,
        
        // 확인 모달
        confirmModal: null,
        confirmMessage: null,
        confirmCancelBtn: null,
        confirmOkBtn: null,

        // 은행 모달
        bankModal: null,
        bankCloseBtn: null,
        saveAmount: null,
        saveBtn: null,
        saveWithdrawBtn: null,
        loanAmount: null,
        loanBtn: null,
        repayBtn: null,
        bankruptBtn: null,
        bankruptCooldownTimer: null,
        bankModalCash: null,
        // 예금 모달
        bankSavingsAmount: null,
        bankNextInterest: null,
        bankNextInterestTimer: null,
        // 대출 모델
        bankLoanAmount: null,
        maxLoanInfo: null,
        bankRepaymentAmount: null,
        bankNextLoanTimer: null,

        //타임 어택 모달
        timeAttackBtn: null,
        timeAttackCancelBtn: null,

        // 랭킹 모달
        rankingModal: null,
        rankingCloseBtn: null,
        showNetWorthRankBtn: null,
        showTimeAttackRankBtn: null,
        rankingList: null,

        // 관리자 전용 모달
        adminMenuBtn: null,
        adminModal: null,
        adminCloseBtn: null,
        devResetBtn: null,
        adminNewsContent: null,
        adminNewsSubmitBtn: null,

        // 뉴스 모달
        newsBox: null,

        // 주가 조작
        adminStockTicker: null,
        adminStockPrice: null,
        adminStockManipulateBtn: null,
    };

    
    // === 4. Firebase References ===
    const auth = firebase.auth();
    const db = firebase.database();
    
    let playerRef = null; // (로그인 후 설정됨: db.ref(`players/${user.uid}`))
    const marketRef = db.ref('market');
    

    // === 5. Main Initialization ===
    
    /**
     * DOM ID와 els 객체를 바인딩
     */
    function bindDOMElements() {
        for (const key in els) {
            els[key] = document.getElementById(key);
            if (!els[key]) {
                console.warn(`DOM Element ID "${key}"를 찾을 수 없습니다.`);
            }
        }
    }

    /**
     * 게임 시작 (DOM 로드 후 호출됨)
     */
    function initGame() {
        bindDOMElements();
        if (!els.googleLoginBtn) {
            console.error("초기화 실패: 필수 DOM(googleLoginBtn)을 찾을 수 없습니다.");
            return;
        }
        setupEventListeners();
        
        // 인증 리스너 시작 (가장 먼저)
        setupAuthListener(); 

        const newsRef = db.ref('news');
        newsRef.on('value', (snapshot) => {
            const newsData = snapshot.val();
            // UI 갱신 함수 호출
            updateNewsBoxUI(newsData);
        })

        setInterval(applyBankInterest, 10 * 60 * 1000);
        
        // (로그인 성공 시, setupAuthListener가 다른 리스너들을 호출)
    }

    
    // === 6. Event Listeners Setup ===
    
    /**
     * 모든 UI 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 인증
        els.googleLoginBtn.addEventListener('click', signInWithGoogle);
        els.logoutBtn.addEventListener('click', signOut);

        // 탭
        els.showStocksBtn.addEventListener('click', () => switchView('stocks'));
        els.showAssetsBtn.addEventListener('click', () => switchView('assets'));
        els.showBondsBtn.addEventListener('click', () => switchView('bonds'));
        els.showCoinsBtn.addEventListener('click', () => switchView('coins'));
        els.showMiscBtn.addEventListener('click', () => switchView('misc'));
        

        // 거래
        els.buyBtn.addEventListener('click', handleBuyStock);
        els.sellBtn.addEventListener('click', handleSellStock);
        els.buyMaxBtn.addEventListener('click', handleBuyMax);
        els.sellAllBtn.addEventListener('click', handleSellAll);

        // 버튼
        els.timeAttackBtn.addEventListener('click', handleStartTimeAttack);

        // 알림/확인 모달
        els.alertCloseBtn.addEventListener('click', hideAlert);

        // 은행 모달
        els.bankBtn.addEventListener('click', showBankModal);
        els.bankCloseBtn.addEventListener('click', hideBankModal);
        els.saveBtn.addEventListener('click', () => handleBankSave('save'));
        els.saveWithdrawBtn.addEventListener('click', () => handleBankSave('withdraw'));
        els.loanBtn.addEventListener('click', () => handleBankLoan('loan'));
        els.repayBtn.addEventListener('click', () => handleBankLoan('repay'));
        els.bankruptBtn.addEventListener('click', promptBankruptConfirmation);

        //타임어택 모달
        els.timeAttackCancelBtn.addEventListener('click', handleCancelTimeAttack);

        // 랭킹 모달
        els.showRankingModalBtn.addEventListener('click', showRankingModal);
        els.rankingCloseBtn.addEventListener('click', hideRankingModal);
        els.showNetWorthRankBtn.addEventListener('click', () => switchRankView('networth'));
        els.showTimeAttackRankBtn.addEventListener('click', () => switchRankView('timeattack'));

        // 관리자 전용 모달
        els.adminMenuBtn.addEventListener('click', showAdminModal);
        els.adminCloseBtn.addEventListener('click', hideAdminModal);
        els.devResetBtn.addEventListener('click', handleAdminReset);
        els.adminNewsSubmitBtn.addEventListener('click', handlePostNews);
        els.adminStockManipulateBtn.addEventListener('click', handleAdminStockManipulate);
        
        els.historyList = document.getElementById('historyList');
        els.newsBox = document.getElementById('newsBox');
        els.adminStockTicker = document.getElementById('adminStockTicker');
        els.adminStockPrice = document.getElementById('adminStockPrice');
        els.adminStockManipulateBtn = document.getElementById('adminStockManipulateBtn');
    }

    
    // === 7. Firebase Listeners (Auth, Player, Market) ===
    
    /**
     * 인증 상태 리스너 설정
     */
    function setupAuthListener() {
        authUnsubscribe = auth.onAuthStateChanged((user) => {

            // [1] 여기에 2단계에서 복사한 본인의 UID를 붙여넣으세요!
            const ADMIN_UID = "CBHVz5QNzUgiES6psrBYOREsgJE2"; 
            

            // [2] 현재 로그인한 유저가 관리자인지 확인
            if (user.uid === ADMIN_UID) {
                // 관리자라면 'hidden' 클래스를 제거 (버튼 보이기)
                if (els.adminMenuBtn) {
                els.adminMenuBtn.classList.remove('hidden');
                }
            } else {
                // 관리자가 아니라면 'hidden' 클래스를 유지 (버튼 숨기기)
                if (els.adminMenuBtn) {
                   els.adminMenuBtn.classList.add('hidden');
                }
            }
            
            if (user) {
                // 로그인 성공
                console.log("로그인 성공:", user.uid);
                playerRef = db.ref(`players/${user.uid}`);
                
                // 리스너 연결
                setupPlayerListener(user); // (플레이어 데이터 없으면 생성)
                setupMarketListener();
                setupNetWorthListener();
                setupTimeAttackListener();

                // UI 처리
                els.authScreen.classList.add('hidden');
                els.mainGame.classList.remove('hidden');
                
                initChart();

                const isAdmin = (user.email === "20240183@bangok.hs.kr" || user.email === "jaewon.lee.2008@gmail.com");

                if (isAdmin) {
                    console.log("관리자 계정으로 로그인되었습니다.");
                    // (관리자 탭 표시 등)
                    // if (els.adminTabBtn) els.adminTabBtn.classList.remove('hidden');
                    
                    // [경고] 2명 이상의 관리자가 접속하면 이 타이머가 중복 실행됩니다!
                    startMarketTimer();
                    
                } else {
                    console.log("일반 사용자로 로그인되었습니다.");
                    // (관리자 탭 숨기기 등)
                    // if (els.adminTabBtn) els.adminTabBtn.classList.add('hidden');
                }
                
            } else {
                // 로그아웃 성공
                console.log("로그아웃됨");
                playerRef = null;

                stopMarketTimer();

                // 모든 DB 리스너 해제
                if (playerUnsubscribe) playerUnsubscribe();
                if (marketUnsubscribe) marketUnsubscribe();
                // (랭킹 리스너 등 다른 리스너도 해제 필요)

                // UI 처리
                els.authScreen.classList.remove('hidden');
                els.mainGame.classList.add('hidden');
            }
        });
    }

    /**
     * 플레이어 데이터 리스너 설정
     */
    function setupPlayerListener(user) {
        
        // ▼▼▼ [수정] 관리자(Admin) 확인 로직 ▼▼▼
        
        // [1] 여기에 본인의 UID가 들어가 있어야 합니다.
        const ADMIN_UID = "CBHVz5QNzUgiES6psrBYOREsgJE2"; // (본인 UID)

        // [2] 현재 로그인한 유저가 관리자인지 확인
        if (user.uid === ADMIN_UID) {
            // 관리자라면 'hidden' 클래스를 제거 (버튼 보이기)
            if (els.adminMenuBtn) {
                els.adminMenuBtn.classList.remove('hidden');
            }
        } else {
            // 관리자가 아니라면 'hidden' 클래스를 유지 (버튼 숨기기)
            if (els.adminMenuBtn) {
                els.adminMenuBtn.classList.add('hidden');
            }
        }
        
        playerRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                // 데이터가 있으면 state에 저장
                state = snapshot.val();
                
                // ▼▼▼ [수정] 타임 어택 상태 확인 및 복구 ▼▼▼
                if (state.timeAttack && state.timeAttack.isInTimeAttack) {
                    if (timeAttackTimer) clearInterval(timeAttackTimer); 
                    
                    const startTime = state.timeAttack.startTime;
                    const elapsedMs = Date.now() - startTime; 
                    const remainingSeconds = TIME_ATTACK_DURATION - Math.floor(elapsedMs / 1000);

                    if (remainingSeconds <= 0) {
                        // (시간 초과 -> 자동 종료)
                        showAlert("진행 중이던 타임 어택이 종료되었습니다. 결과를 처리합니다.");
                        handleEndTimeAttack(); 
                        isTimeAttackListenerInitialized = false; // [신규] 플래그 리셋
                    } else {
                        // (시간 남음 -> 타이머 재개)
                        
                        // ▼▼▼ [수정] 플래그를 확인하여 알림을 1회만 띄움 ▼▼▼
                        if (!isTimeAttackListenerInitialized) {
                            showAlert(`진행 중인 타임 어택을 재개합니다. (남은 시간: ${Math.floor(remainingSeconds/60)}분)`);
                            isTimeAttackListenerInitialized = true; // 플래그 설정
                        }
                        // ▲▲▲ [수정] ▲▲▲

                        startTimeAttackTimer(remainingSeconds); 
                        
                        els.timeAttackBtn.disabled = true;
                        els.timeAttackBtn.textContent = "타임 어택 진행 중...";
                        els.timeAttackTimerDisplay.classList.remove('hidden');
                        els.timeAttackCancelBtn.classList.remove('hidden'); 
                    }
                } else {
                    // (타임 어택 중이 아닐 때)
                    if (timeAttackTimer) clearInterval(timeAttackTimer);
                    timeAttackTimer = null;
                    
                    isTimeAttackListenerInitialized = false; // [신규] 플래그 리셋
                    
                    els.timeAttackBtn.disabled = false;
                    els.timeAttackBtn.textContent = `🔥 타임 어택 (${TIME_ATTACK_DURATION / 60}분)`;
                    els.timeAttackTimerDisplay.classList.add('hidden');
                    els.timeAttackCancelBtn.classList.add('hidden'); 
                }
                // ▲▲▲ [수정] 로직 끝 ▲▲▲

                updateUI(); // UI 갱신
            } else {
                // (새 플레이어 생성)
                console.log("새 플레이어 데이터 생성 중...");
                const initialState = createInitialPlayerState(user);
                playerRef.set(initialState);
            }
        }, (error) => {
            console.error("플레이어 데이터 읽기 실패:", error);
            showAlert("플레이어 데이터를 불러오는 데 실패했습니다.");
        });
    }

    /**
     * 마켓 데이터 리스너 설정
     */
    function setupMarketListener() {
        const stocksRef = marketRef.child('stocks');
        
        marketUnsubscribe = stocksRef.on('value', (snapshot) => {
            const marketData = snapshot.val();
            
            if (marketData) {
                Object.assign(stockData, marketData);
            } else {
                // 마켓 데이터가 없으면 (최초 실행)
                console.log("마켓 데이터 없음. 초기화 시도...");
                // (참고: 실제로는 관리자만 초기화해야 함)
                // const initialState = createInitialMarketState();
                // stocksRef.set(initialState);
            }
            
            // (플레이어 데이터(state)가 로드된 후에만 실행)
            if (state && state.stocks) {
                
                // 1. 현재 플레이어가 보유한 주식 목록 순회
                for (const ticker in state.stocks) {
                    const playerStock = state.stocks[ticker];
                    const marketStock = stockData[ticker]; // 방금 갱신된 마켓 데이터

                    // 2. 조건 확인:
                    // (1) 플레이어가 1주 이상 보유
                    // (2) 마켓에 정보가 있음
                    // (3) 마켓에서 '상장폐지' 상태임
                    if (playerStock && playerStock.shares > 0 && marketStock && marketStock.isDelisted) {
                        
                        // 3. 조건 만족 시, 강제 청산 함수 호출
                        // (이 함수는 1초마다 호출될 수 있지만,
                        // 함수 내부의 트랜잭션이 1회 실행을 보장함)
                        handleForceLiquidate(ticker);
                    }
                }
            }

            // UI 갱신 (탭, 주식 정보, 포트폴리오)
            renderStockList();
            updateStockInfoUI();
            updatePortfolioUI();

            // [랭킹] 주가 변동 시, 총 자산 랭킹 갱신
            updateNetWorthRankings(); 
        });
    }

    
    // === 8. Core Logic (Buy, Sell, Reset) ===

    /**
     * [최종 수정본] 매수 (NaN, TypeError, Error: set 방어)
     */
    function handleBuyStock() {
        const amount = parseInt(els.amount.value, 10); 
        const ticker = currentTicker;

        // [방어 1] 수량 검사
        if (isNaN(amount) || amount <= 0) {
            showAlert("유효한 수량을 입력하세요.");
            return;
        }

        playerRef.transaction((currentPlayerData) => {
            if (!currentPlayerData) return; // 데이터 로드 전

            const market = stockData[ticker];

            // [방어 2] 마켓/가격 검사 (NaN, undefined, type)
            if (!market || market.isDelisted || typeof market.price !== 'number' || isNaN(market.price)) {
                showAlert("현재 거래할 수 없는 종목입니다. (가격 정보 오류)");
                return; // 트랜잭션 중단
            }

            const price = market.price;
            const cost = (price * amount) * (1 + FEE_RATE);

            // [방어 3] 비용(cost) 계산 검사 (FEE_RATE가 undefined일 경우)
            if (isNaN(cost)) {
                console.error("비용(cost) 계산 실패. FEE_RATE가 정의되었는지 확인하세요.");
                showAlert("거래 비용 계산에 실패했습니다. (FEE_RATE 오류)");
                return; // 트랜잭션 중단
            }
            
            // [방어 4] 현금 '정화' (DB에 NaN이 저장된 경우)
            let currentCash = Number(currentPlayerData.cash);
            if (isNaN(currentCash)) { currentCash = 0; }

            if (currentCash < cost) {
                showAlert("현금이 부족합니다.");
                return; // 트랜잭션 중단
            }

            // [방어 5] stocks 객체에 티커가 없는 경우 (Admin Reset 이후)
            if (!currentPlayerData.stocks[ticker]) {
                currentPlayerData.stocks[ticker] = { shares: 0, averagePrice: 0 };
            }

            const stock = currentPlayerData.stocks[ticker];
            
            // [방어 6] 보유량/평단가 '정화' (DB에 NaN이 저장된 경우)
            let currentShares = Number(stock.shares);
            if (isNaN(currentShares)) { currentShares = 0; }
            
            let currentAvgPrice = Number(stock.averagePrice);
            if (isNaN(currentAvgPrice)) { currentAvgPrice = 0; }

            // '정화된' 값으로만 계산
            currentPlayerData.cash = currentCash - cost; 

            const newTotalShares = currentShares + amount;
            const newTotalValue = (currentAvgPrice * currentShares) + (price * amount);
            // (newTotalShares는 0이 될 수 없으므로 0으로 나누기 방어 불필요)
            const newAveragePrice = newTotalValue / newTotalShares;

            stock.shares = newTotalShares;
            stock.averagePrice = newAveragePrice; 

            // [방어 7] history 로그 추가 (history가 undefined일 경우 방어)
            addHistoryLogToPlayer(currentPlayerData, 
                `[매수] ${market.name || ticker} (${ticker}) ${amount}주 (총 ${formatCurrency(cost)})`, 
                'buy'
            );
            return currentPlayerData;
        })
        .then((result) => {
            if (!result.committed) { 
                // (트랜잭션 내부에서 이미 알림을 띄웠으므로, 여기서는 .catch()만 처리)
            }
        })
        .catch((error) => {
             // (이곳이 Error: set이 잡히는 곳)
             console.error("Firebase 매수 트랜잭션 오류 (Promise):", error);
             showAlert("매수 실패. DB 오류가 발생했습니다. (NaN 또는 undefined 저장 시도)");
        });
    }

    function handleBuyMax() {
        const ticker = currentTicker;

        playerRef.transaction((currentPlayerData) => {
            if (!currentPlayerData) return;

            const market = stockData[ticker];

            // [방어 1] 마켓/가격 검사
            if (!market || market.isDelisted || typeof market.price !== 'number' || isNaN(market.price)) {
                showAlert("현재 거래할 수 없는 종목입니다. (가격 정보 오류)");
                return; 
            }

            const price = market.price;
            const pricePerShare = price * (1 + FEE_RATE); // 수수료 포함 1주당 가격

            // [방어 2] 비용(cost) 계산 검사 (FEE_RATE가 undefined일 경우)
            if (isNaN(pricePerShare)) {
                console.error("1주당 비용(pricePerShare) 계산 실패. FEE_RATE가 정의되었는지 확인하세요.");
                showAlert("거래 비용 계산에 실패했습니다. (FEE_RATE 오류)");
                return;
            }
            
            // [방어 3] 현금 '정화'
            let currentCash = Number(currentPlayerData.cash);
            if (isNaN(currentCash)) { currentCash = 0; }

            // ▼▼▼ [핵심 로직] 최대 수량 계산 ▼▼▼
            const maxAmount = Math.floor(currentCash / pricePerShare);
            
            if (maxAmount <= 0) {
                showAlert("1주도 매수할 현금이 부족합니다.");
                return;
            }
            
            // 실제 총 비용 계산
            const totalCost = maxAmount * pricePerShare;
            // (이론상 currentCash < totalCost는 발생하지 않아야 함)
            // ▲▲▲ [핵심 로직] 끝 ▲▲▲


            // [방어 4] stocks 객체에 티커가 없는 경우
            if (!currentPlayerData.stocks[ticker]) {
                currentPlayerData.stocks[ticker] = { shares: 0, averagePrice: 0 };
            }

            const stock = currentPlayerData.stocks[ticker];
            
            // [방어 5] 보유량/평단가 '정화'
            let currentShares = Number(stock.shares);
            if (isNaN(currentShares)) { currentShares = 0; }
            
            let currentAvgPrice = Number(stock.averagePrice);
            if (isNaN(currentAvgPrice)) { currentAvgPrice = 0; }

            // '정화된' 값으로만 계산
            currentPlayerData.cash = currentCash - totalCost; 

            const newTotalShares = currentShares + maxAmount; // 'amount' 대신 'maxAmount'
            const newTotalValue = (currentAvgPrice * currentShares) + (price * maxAmount); // 'amount' 대신 'maxAmount'
            const newAveragePrice = newTotalValue / newTotalShares;

            stock.shares = newTotalShares;
            stock.averagePrice = newAveragePrice; 

            // [방어 6] history 로그 추가
            addHistoryLogToPlayer(currentPlayerData, 
                `[전액 매수] ${market.name || ticker} (${ticker}) ${maxAmount}주 (총 ${formatCurrency(totalCost)})`, 
                'buy'
            );
            return currentPlayerData;
        })
        .then((result) => {
            if (!result.committed) { /* (내부 알림) */ }
        })
        .catch((error) => {
             console.error("Firebase 전액 매수 트랜잭션 오류 (Promise):", error);
             showAlert("전액 매수 실패. DB 오류가 발생했습니다. (NaN 또는 undefined 저장 시도)");
        });
    }

    /**
     * [최종 수정본] 매도 (NaN, TypeError, Error: set 방어)
     */
    function handleSellStock() {
        const amount = parseInt(els.amount.value, 10);
        const ticker = currentTicker;

        if (isNaN(amount) || amount <= 0) {
            showAlert("유효한 수량을 입력하세요.");
            return;
        }

        playerRef.transaction((currentPlayerData) => {
            if (!currentPlayerData) return;

            const stock = currentPlayerData.stocks[ticker];
            
            // [방어 1, 2, 3] 현금, 주식, 평단가 '정화'
            let currentShares = Number(stock ? stock.shares : 0);
            if (isNaN(currentShares)) { currentShares = 0; }
            
            let currentAvgPrice = Number(stock ? stock.averagePrice : 0);
            if (isNaN(currentAvgPrice)) { currentAvgPrice = 0; }
            
            let currentCash = Number(currentPlayerData.cash);
            if (isNaN(currentCash)) { currentCash = 0; }

            // [방어 4] 보유량 검사 (정화된 값 기준)
            if (currentShares <= 0) {
                showAlert("보유하지 않은 종목입니다.");
                return;
            }
            if (amount > currentShares) {
                showAlert("보유 수량보다 많이 매도할 수 없습니다.");
                return;
            }

            const market = stockData[ticker];
            // [방어 5] 마켓/가격 검사
            if (!market || market.isDelisted || typeof market.price !== 'number' || isNaN(market.price)) {
                showAlert("현재 거래할 수 없는 종목입니다. (가격 정보 오류)");
                return;
            }
            
            const price = market.price; 
            const revenue = (price * amount) * (1 - FEE_RATE); 
            
            // [방어 6] 수익(revenue) 계산 검사 (FEE_RATE)
            if (isNaN(revenue)) {
                console.error("수익(revenue) 계산 실패. FEE_RATE가 정의되었는지 확인하세요.");
                showAlert("거래 수익 계산에 실패했습니다. (FEE_RATE 오류)");
                return;
            }
            
            // '정화된' 값으로만 계산
            const profit = (price - currentAvgPrice) * amount - (price * amount * FEE_RATE);

            currentPlayerData.cash = currentCash + revenue;
            stock.shares = currentShares - amount;
            
            if (stock.shares === 0) {
                stock.averagePrice = 0;
            }

            // [방어 7] history 로그 추가
            addHistoryLogToPlayer(currentPlayerData, 
                `[매도] ${market.name || ticker} (${ticker}) ${amount}주 (실현손익: ${formatCurrency(profit)})`, 
                'sell'
            );
            return currentPlayerData;
        })
        .then((result) => {
             if (!result.committed) { /* (내부 알림) */ }
        })
        .catch((error) => {
             console.error("Firebase 매도 트랜잭션 오류 (Promise):", error);
             showAlert("매도 실패. DB 오류가 발생했습니다. (NaN 또는 undefined 저장 시도)");
        });
    }

    function handleSellAll() {
        
        // 1. [복원] showConfirm() 확인 절차
        // (showConfirm이 <br> 태그를 지원하도록 수정되었음)
        const confirmMsg = "🚨 경고 🚨<br><br>보유한 모든 주식을 현재 시장가로 즉시 매도합니다.<br>(상장 폐지 등 거래 불가 종목 제외)<br><br>정말로 실행하시겠습니까?";
        
        showConfirm(confirmMsg, () => {
            
            // 2. 확인 시 트랜잭션 실행
            playerRef.transaction((currentPlayerData) => {
                if (!currentPlayerData) return;

                if (!currentPlayerData.stocks) {
                    currentPlayerData.stocks = {};
                }

                let totalRevenue = 0; // 총 매도 수익
                let totalProfit = 0;  // 총 실현 손익
                let soldCount = 0;    // 매도한 종목 수

                // [방어 1] 현금 정화 (NaN 방지)
                let currentCash = Number(currentPlayerData.cash);
                if (isNaN(currentCash)) { currentCash = 0; }
                
                // [방어 2] history 정화 (TypeError 방지)
                if (!Array.isArray(currentPlayerData.history)) {
                    currentPlayerData.history = [];
                }

                // 3. 보유한 모든 주식 티커를 순회
                for (const ticker in currentPlayerData.stocks) {
                    const stock = currentPlayerData.stocks[ticker];
                    
                    // [방어 3] 주식 객체 및 보유량 정화
                    let currentShares = Number(stock ? stock.shares : 0);
                    if (isNaN(currentShares)) { currentShares = 0; }
                    
                    let currentAvgPrice = Number(stock ? stock.averagePrice : 0);
                    if (isNaN(currentAvgPrice)) { currentAvgPrice = 0; }

                    // 4. 매도할 주식이 1주 이상 있는지 확인
                    if (currentShares > 0) {
                        const market = stockData[ticker];

                        // [방어 4] 마켓/가격 검사 (거래 가능한지)
                        if (market && !market.isDelisted && typeof market.price === 'number' && !isNaN(market.price)) {
                            
                            const price = market.price;
                            const revenue = (price * currentShares) * (1 - FEE_RATE);
                            
                            // [방어 5] 수익(revenue) 계산 검사 (FEE_RATE)
                            if (isNaN(revenue)) {
                                console.error(`[전액 매도] ${ticker} 수익(revenue) 계산 실패. FEE_RATE 확인.`);
                                continue; // 이 종목은 건너뜀
                            }
                            
                            // 5. 총 수익 및 실현 손익 누적
                            totalRevenue += revenue;
                            totalProfit += (price - currentAvgPrice) * currentShares - (price * currentShares * FEE_RATE);
                            soldCount++;

                            // 6. 주식 보유량 0으로 초기화
                            stock.shares = 0;
                            stock.averagePrice = 0;

                        } else {
                            // (거래 불가능한 종목은 무시)
                            console.log(`[전액 매도] ${ticker}는 거래 불가 상태이므로 건너뜁니다.`);
                        }
                    }
                } // for-loop 끝

                // 7. 최종 결과 적용
                if (soldCount > 0) {
                    currentPlayerData.cash = currentCash + totalRevenue;
                    
                    addHistoryLogToPlayer(currentPlayerData, 
                        `[전액 매도] ${soldCount}개 종목 청산 (총 수익: ${formatCurrency(totalRevenue)}, 총 손익: ${formatCurrency(totalProfit)})`, 
                        'sell'
                    );
                } else {
                    // 매도할 주식이 하나도 없었으면 트랜잭션 중단
                    return; 
                }

                return currentPlayerData;
            })
            .then((result) => {
                if (!result.committed) {
                    // (매도할 주식이 없을 때의 알림은 유지)
                    showAlert("매도할 수 있는 주식이 없습니다.");
                } else {
                    // (완료 알림은 사용자가 삭제 요청했으므로 복원하지 않음)
                }
            })
            .catch((error) => {
                 console.error("Firebase 전액 매도 트랜잭션 오류 (Promise):", error);
                 showAlert("전액 매도 실패. DB 오류가 발생했습니다. (NaN 또는 undefined 저장 시도)");
            });

        }); // 3. [복원] showConfirm 닫는 괄호
    }
    
    /**
     * [신규] 상장폐지된 특정 주식을 강제 청산(매도)합니다.
     * @param {string} ticker 청산할 주식 티커
     */    
    function handleForceLiquidate(ticker) {
        // 이 함수는 setupMarketListener에 의해 1초마다 호출될 수 있습니다.
        // 하지만 트랜잭션 내부의 'shares > 0' 체크가 단 1회만 실행되도록 보장합니다.

        const market = stockData[ticker];
        
        // (1) 마켓 데이터가 없거나, (2) 가격이 숫자가 아니거나 (NaN 방어)
        if (!market || typeof market.price !== 'number' || isNaN(market.price)) {
            console.error(`[강제 청산] ${ticker}의 마켓/가격 정보를 찾을 수 없어 청산을 건너뜁니다.`);
            return; // 마켓 정보 없으면 중단
        }
        
        // 상장폐지 가격 (이것이 마지막 거래 가격임)
        const delistPrice = market.price;
        // 매도 수수료(FEE_RATE)를 뺀 1주당 실제 수익
        const pricePerShare = delistPrice * (1 - FEE_RATE);
        
        if (isNaN(pricePerShare)) {
             console.error(`[강제 청산] ${ticker}의 청산 비용 계산 실패 (FEE_RATE 오류).`);
             return; // 수수료 계산 실패 시 중단
        }

        playerRef.transaction((currentPlayerData) => {
            if (!currentPlayerData) return;

            const stock = currentPlayerData.stocks[ticker];

            // [핵심 방어]
            // 1. stock 객체가 없거나
            // 2. 이미 청산되어 shares가 0이거나 NaN/undefined일 경우
            let currentShares = Number(stock ? stock.shares : 0);
            if (isNaN(currentShares) || currentShares <= 0) {
                return; // 이미 청산되었거나 보유량이 없으므로 트랜잭션 중단
            }
            
            // (정화 로직)
            let currentAvgPrice = Number(stock ? stock.averagePrice : 0);
            if (isNaN(currentAvgPrice)) { currentAvgPrice = 0; }

            let currentCash = Number(currentPlayerData.cash);
            if (isNaN(currentCash)) { currentCash = 0; }

            // 1. 총 수익 계산
            const revenue = pricePerShare * currentShares;
            // 2. 실현 손익 계산
            const profit = (delistPrice - currentAvgPrice) * currentShares - (delistPrice * currentShares * FEE_RATE);

            // 3. 현금에 수익 추가
            currentPlayerData.cash = currentCash + revenue;
            // 4. 주식 보유량 0으로 강제 청산
            stock.shares = 0; 
            stock.averagePrice = 0;

            // 5. 로그 추가
            
            return currentPlayerData;
        })
        .catch((error) => {
            // (트랜잭션이 중단(return)된 것은 에러가 아님)
            if (error) {
                console.error(`[강제 청산] ${ticker} 트랜잭션 실패:`, error);
            }
        });
    }

    /**
     * [수정] 관리자 리셋 (마켓 + 본인 계정)
     */
    function handleAdminReset() {
        const password = prompt("관리자 비밀번호를 입력하세요 (기본값: admin):");
        if (password === 'ILoveCat') { 
            
            if (confirm("🚨 경고 🚨\n\n'마켓 데이터'와 '당신 자신의 플레이어 데이터'를 모두 초기화하시겠습니까?\n\n(다른 플레이어의 데이터는 유지됩니다)")) {
                
                try {
                    const initialState = createInitialMarketState(); 
                    
                    // 작업 1: 마켓 리셋
                    const marketResetPromise = marketRef.child('stocks').set(initialState);
                    
                    // 작업 2: '나'의 플레이어 데이터 삭제
                    const playerResetPromise = playerRef.remove(); 

                    Promise.all([marketResetPromise, playerResetPromise])
                        .then(() => {
                            showAlert("✅ Admin Reset 완료", "마켓과 당신의 데이터가 초기화되었습니다. 페이지를 새로고침합니다.");
                            location.reload(); 
                        })
                        .catch((err) => {
                            console.error("Firebase 쓰기 오류:", err);
                            showAlert("❌ 초기화 실패", "Firebase 쓰기 권한을 확인하세요.");
                        });

                } catch (e) {
                    console.error("초기화 함수(createInitialMarketState) 오류:", e);
                    showAlert("❌ 초기화 실패", "createInitialMarketState 함수에 구문 오류가 있습니다. F12 콘솔을 확인하세요.");
                }
            }
        } else if (password !== null) { 
            showAlert("❌ 비밀번호가 틀렸습니다.");
        }
    }

    function handlePostNews() {
        if (!els.adminNewsContent) return;

        const content = els.adminNewsContent.value.trim();
        
        if (!content) {
            showAlert("뉴스 내용을 입력하세요.");
            return;
        }

        // DB의 '/news' 경로에 새 항목을 push (고유 ID 생성)
        const newsRef = db.ref('news');
        newsRef.push({
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            message: content
        })
        .then(() => {
            showAlert("뉴스를 성공적으로 게시했습니다.");
            els.adminNewsContent.value = ''; // 입력창 비우기
        })
        .catch((error) => {
            console.error("뉴스 게시 오류:", error);
            showAlert("뉴스 게시에 실패했습니다. (DB 오류)");
        });
    }

    function handleAdminStockManipulate() {
        if (!els.adminStockTicker || !els.adminStockPrice) return;

        const ticker = els.adminStockTicker.value.trim().toUpperCase();
        const newPrice = parseFloat(els.adminStockPrice.value);

        if (!ticker) {
            showAlert("종목 코드를 입력하세요.");
            return;
        }
        if (isNaN(newPrice) || newPrice <= 0) {
            showAlert("올바른 가격(숫자)을 입력하세요.");
            return;
        }

        // ▼▼▼ [경로 수정] 'market/stock/' + ticker ▼▼▼
        const stockRef = db.ref(`market/stocks/${ticker}`);
        // ▲▲▲ [경로 수정] ▲▲▲
        
        stockRef.transaction((currentStockData) => {
            
            if (currentStockData === null) {
                console.warn(`관리자: ${ticker}는 새 종목입니다. history를 새로 시작합니다.`);
                return {
                    price: newPrice,
                    history: [newPrice], 
                    isDelisted: false
                };
            }

            let currentHistory = [];
            if (currentStockData.history && Array.isArray(currentStockData.history)) {
                currentHistory = currentStockData.history;
            }

            currentHistory.push(newPrice);
            
            while (currentHistory.length > 30) {
                currentHistory.shift();
            }

            return {
                ...currentStockData, 
                price: newPrice,
                history: currentHistory
            };
            
        }, (error, committed, snapshot) => {
            if (error) {
                console.error("주가 설정 (트랜잭션) 오류:", error);
                showAlert(`주가 설정에 실패했습니다. (오류: ${error.message})`);
            } else if (!committed) {
                console.warn("주가 설정 트랜잭션이 커밋되지 않았습니다. (데이터 경합)");
            } else {
                showAlert(`[${ticker}] 종목의 가격을 ${formatCurrency(newPrice)} (으)로 강제 설정했습니다.`);
                els.adminStockTicker.value = '';
                els.adminStockPrice.value = '';
            }
        });
    }

    /**
     * 인증: 구글 로그인
     */
    function signInWithGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch((error) => {
            console.error("Google 로그인 실패:", error);
            showAlert(`로그인 실패: ${error.message}`);
        });
    }

    /**
     * 인증: 로그아웃
     */
    function signOut() {
        auth.signOut();
    }


    // === 9. Bank Logic ===
    
    function showBankModal() {
        if (!state.bank) { // 혹시 bank 객체가 없으면 생성
            state.bank = { checking: 0, savings: 0, loan: 0, loanRepay: 0, savingsTimestamp: null, loanTimestamp: null };
            playerRef.child('bank').set(state.bank);
        }

        if (els.bankModalCash) {
             els.bankModalCash.textContent = formatCurrency(state.cash);
        }

        if (els.maxLoanInfo) {
            const maxLoan = (Number(state.cash) || 0) * 3;
            els.maxLoanInfo.textContent = formatCurrency(maxLoan);
        }
 
        els.bankModal.classList.remove('hidden');
        els.bankModal.classList.add('flex');

        if (bankTimer) clearInterval(bankTimer); // 기존 타이머 정리
        updateBankTimerUI(); // 즉시 1회 실행
        bankTimer = setInterval(updateBankTimerUI, 1000); // 1초마다 갱신
    }

    function hideBankModal() {
        
        if (bankTimer) {
            clearInterval(bankTimer);
            bankTimer = null;
        }

        els.bankModal.classList.add('hidden');
        els.bankModal.classList.remove('flex');
    }

    function handleBankSave(type) {
        
        playerRef.transaction((currentPlayerData) => {
            if (!currentPlayerData) return;
            
            if (!currentPlayerData.bank) {
                currentPlayerData.bank = { savings: 0, savingsTimestamp: null, loan: 0, loanTimestamp: null, loanRepayTimestamp: null, bankruptTimestamp: null };
            }

            let currentCash = Number(currentPlayerData.cash) || 0;
            let currentSavings = Number(currentPlayerData.bank.savings) || 0;

            // --- 1. 예금 (Save) ---
            if (type === 'save') {
                let amount = Number(els.saveAmount.value);
                if (isNaN(amount) || amount <= 0) {
                    showAlert("정확한 예금액을 입력하세요.");
                    return; 
                }
                
                // [체크 1] 대출 중 예금 방지
                if (currentPlayerData.bank.loan > 0) {
                    showAlert("대출이 있는 상태에서는 예금할 수 없습니다.");
                    return;
                }
                
                // ▼▼▼ [신규] 추가 예금 방지 로직 ▼▼▼
                if (currentSavings > 0) {
                    showAlert("이미 예금이 있습니다. 전액 인출 후 다시 시도하세요. (추가 예금 불가)");
                    return;
                }
                // ▲▲▲ [신규] ▲▲▲

                // [체크 3] 현금 부족
                if (currentCash < amount) {
                    showAlert("예금할 현금이 부족합니다.");
                    return;
                }

                if ( amount > 100000000000) {
                    showAlert(" 100억 이상 예금할 수 없습니다.");
                    return;
                }

                currentPlayerData.cash = currentCash - amount;
                currentPlayerData.bank.savings = currentSavings + amount; // (currentSavings는 0이어야 함)
                currentPlayerData.bank.savingsTimestamp = firebase.database.ServerValue.TIMESTAMP; 
                
            // --- 2. 전액 인출 (Withdraw) ---
            } else if (type === 'withdraw') {
                if (currentSavings <= 0) {
                    showAlert("인출할 예금이 없습니다.");
                    return;
                }

                let amountToReceive = currentSavings;

                const depositTime = currentPlayerData.bank.savingsTimestamp;

                if (depositTime) {
                    const currentTime = Date.now(); // 현재 시간 (밀리초)
                    const elapsedMilliseconds = currentTime - depositTime; // 경과 시간 (밀리초)

                    // --- 설정값 ---
                    const INTEREST_RATE = 0.02; // 이자율 (2%)
                    const COMPOUNDING_INTERVAL_MS = 50 * 60 * 1000; // 50분 (밀리초)
                    // ---------------

                    // ▼▼▼ [수정됨] ▼▼▼
                    // 총 몇 번의 10분(이자 지급 횟수)이 지났는지 '소수점'으로 계산 (Math.floor 제거)
                    // 예: 15분 지났으면 1.5, 5분 지났으면 0.5
                    const compoundingPeriods = elapsedMilliseconds / COMPOUNDING_INTERVAL_MS;
                    // ▲▲▲ [수정됨] ▲▲▲

                    if (compoundingPeriods > 0) {
                        // 복리 계산: 원금 * (1 + 이자율)^기간
                        // compoundingPeriods가 1.5 같은 소수점이어도 Math.pow가 알아서 계산해 줍니다.
                        const finalAmount = currentSavings * Math.pow((1 + INTEREST_RATE), compoundingPeriods);
                        
                        // 소수점 버림 (게임 화폐는 보통 정수)
                        const roundedFinalAmount = Math.floor(finalAmount); 

                        // 총 인출액 = 원금 + 복리 이자
                        amountToReceive = roundedFinalAmount;

                        // 획득한 이자 (알림용)
                        const earnedInterest = roundedFinalAmount - currentSavings;

                        if (earnedInterest > 0) {
                            // ▼▼▼ [수정됨] ▼▼▼
                            // 알림 메시지를 '횟수'가 아닌 '총 경과 시간(분)'으로 변경
                            const elapsedMinutes = elapsedMilliseconds / (60 * 1000); 
                            showAlert(`총 ${elapsedMinutes.toFixed(1)}분 경과에 대한 복리 이자가 적용되어\n${earnedInterest.toLocaleString()}원을 추가로 받았습니다!`);
                            // ▲▲▲ [수정됨] ▲▲▲
                        }
                    }
                }
                
                // (중도 인출 페널티 로직 삭제됨)

                currentPlayerData.cash = currentCash + amountToReceive;
                currentPlayerData.bank.savings = 0;
                currentPlayerData.bank.savingsTimestamp = null;
                
            }
            return currentPlayerData;
        })
        .catch((error) => {
            console.error("은행 예금/인출 트랜잭션 오류:", error);
            showAlert("은행 예금/인출에 실패했습니다. (DB 오류)");
        });
    }

    function handleBankLoan(type) {
        
        const now = Date.now(); 
        
        playerRef.transaction((currentPlayerData) => {
            if (!currentPlayerData) return;

            if (!currentPlayerData.bank) {
                currentPlayerData.bank = { savings: 0, savingsTimestamp: null, loan: 0, loanTimestamp: null, loanRepayTimestamp: null, bankruptTimestamp: null };
            }

            let currentCash = Number(currentPlayerData.cash) || 0;
            let currentLoan = Number(currentPlayerData.bank.loan) || 0;

            // --- 1. 대출 (Loan) ---
            if (type === 'loan') {
                
                // (쿨타임 체크)
                const repayTime = currentPlayerData.bank.loanRepayTimestamp;
                const TEN_MINUTES_MS = 10 * 60 * 1000;
                
                if (repayTime && (now - repayTime < TEN_MINUTES_MS)) {
                    const remainingMs = TEN_MINUTES_MS - (now - repayTime);
                    const remainingSeconds = Math.floor(remainingMs / 1000);
                    const minutes = Math.floor(remainingSeconds / 60);
                    const seconds = remainingSeconds % 60;
                    
                    showAlert(`대출 쿨타임 중입니다. (남은 시간: ${minutes}분 ${seconds}초)`);
                    return;
                }
                
                let amount = Number(els.loanAmount.value);
                if (isNaN(amount) || amount <= 0) {
                    showAlert("정확한 대출액을 입력하세요.");
                    return;
                }
                
                if (currentLoan > 0) {
                    showAlert("이미 대출이 있습니다. 전액 상환 후 다시 시도하세요. (추가 대출 불가)");
                    return;
                }
                
                const maxLoan = currentCash * 3;
                if (amount > maxLoan) {
                    showAlert(`대출 한도를 초과했습니다. (최대: ${formatCurrency(maxLoan)})`);
                    return;
                }

                // ▼▼▼ [수정] 이자 로직 변경 ▼▼▼
                const interest = amount * 0.20; // 이자 (예: 2,000원)
                const totalDebt = amount + interest; // 총 부채 (예: 12,000원)
                
                // (수수료를 떼지 않고 요청 금액(amount)을 그대로 입금)
                currentPlayerData.cash = currentCash + amount; // (예: 10,000원 받음)
                
                // (부채는 이자가 포함된 금액으로 기록)
                currentPlayerData.bank.loan = totalDebt; // (예: 12,000원 갚아야 함)
                // ▲▲▲ [수정] ▲▲▲
                
                currentPlayerData.bank.loanTimestamp = firebase.database.ServerValue.TIMESTAMP;
                currentPlayerData.bank.loanRepayTimestamp = null; 
                

            // --- 2. 전액 상환 (Repay) ---
            } else if (type === 'repay') {
                if (currentLoan <= 0) {
                    showAlert("상환할 대출금이 없습니다.");
                    return;
                }
                // (currentLoan은 이제 120% 금액이므로 이 로직은 그대로 유지)
                if (currentCash < currentLoan) {
                    showAlert("대출금 전액을 상환할 현금이 부족합니다.");
                    return;
                }

                currentPlayerData.cash = currentCash - currentLoan;
                currentPlayerData.bank.loan = 0;
                currentPlayerData.bank.loanTimestamp = null;
                currentPlayerData.bank.loanRepayTimestamp = firebase.database.ServerValue.TIMESTAMP;
                
            }
            return currentPlayerData;
        })
        .catch((error) => {
            console.error("은행 대출/상환 트랜잭션 오류:", error);
            showAlert("은행 대출/상환에 실패했습니다. (DB 오류)");
        });
    }


    function applyBankInterest() {
        const now = Date.now(); 
        
        if (!playerRef) return; 

        playerRef.transaction((currentPlayerData) => {
            if (!currentPlayerData || !currentPlayerData.bank) {
                return; 
            }

            const bank = currentPlayerData.bank;
            let logMessages = [];
            
            // (단리 이자 지급을 위한 currentCash 변수 제거)
            // let currentCash = Number(currentPlayerData.cash) || 0;
            
            // --- 1. 예금 이자 (10분마다 % 복리) ---
            const TEN_MINUTES_MS = 50 * 60 * 1000;
            const savings = Number(bank.savings) || 0;
            const savingsTime = bank.savingsTimestamp;

            if (savings > 0 && savingsTime && (now - savingsTime >= TEN_MINUTES_MS)) {
                
                const interest = savings * 0.03;
                
                // ▼▼▼ [수정] 단리(현금 지급) -> 복리(원금에 더하기) ▼▼▼
                bank.savings += interest; 
                // (currentPlayerData.cash = currentCash + interest; 코드 삭제)
                // ▲▲▲ [수정] ▲▲▲

                bank.savingsTimestamp = now; // 타이머 리셋
                
            }

            // --- 2. 대출 이자 ( 시작 20% and 10분 쿨타임 ) ---
            const loan = Number(bank.loan) || 0;

            return currentPlayerData;
        });
    }

    function promptBankruptConfirmation() {
        const message = "정말로 파산을 신청하시겠습니까? 모든 자산(주식, 예금)이 청산되며, 현금 300만, 대출 500만으로 시작합니다. (10분 쿨타임 적용)";
        
        // 기존 확인 모달(showConfirmation)을 호출하고,
        // '확인' 버튼을 누르면 실행될 콜백 함수로 'handleBankrupt'를 전달
        showConfirm(message, handleBankrupt);
    }

    function handleBankrupt() {
        const now = Date.now();
        
        playerRef.transaction((currentPlayerData) => {
            if (!currentPlayerData) return;

            // [수정] DB '정화' (bankruptTimestamp 필드 확인)
            if (!currentPlayerData.bank) {
                currentPlayerData.bank = { 
                    savings: 0, savingsTimestamp: null, 
                    loan: 0, loanTimestamp: null, 
                    loanRepayTimestamp: null, bankruptTimestamp: null 
                };
            }

            // --- 1. 10분 쿨타임 체크 (이 로직은 올바름) ---
            const bankruptTime = currentPlayerData.bank.bankruptTimestamp;
            const TEN_MINUTES_MS = 10 * 60 * 1000;
            
            if (bankruptTime && (now - bankruptTime < TEN_MINUTES_MS)) {
                const remainingMs = TEN_MINUTES_MS - (now - bankruptTime);
                const remainingSeconds = Math.floor(remainingMs / 1000);
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = remainingSeconds % 60;
                
                showAlert(`파산 신청 쿨타임 중입니다. (남은 시간: ${minutes}분 ${seconds}초)`);
                return; // 트랜잭션 중단
            }
            
            // --- 2. [버그 수정] 새 객체를 반환(return)하는 대신,
            //          currentPlayerData를 *직접 수정*합니다. ---

            // 주식 초기화
            const initialPlayerStocks = {};
            allTickers.forEach(ticker => {
                initialPlayerStocks[ticker] = { shares: 0, averagePrice: 0 };
            });
            currentPlayerData.stocks = initialPlayerStocks;
            
            // 현금 초기화
            currentPlayerData.cash = 3000000; // (파산 구제금)

            // 은행 초기화 (bank 객체를 통째로 교체)
            currentPlayerData.bank = {
                // (제공해주신 파산 설정값)
                checking: 0, 
                savings: 0, 
                loan: 5000000, // (파산 대출)
                savingsTimestamp: null, 
                loanTimestamp: null,
                loanRepayTimestamp: null, // (다른 필드도 유지)

                // ▼▼▼ [핵심 버그 수정] 쿨타임 *저장* ▼▼▼
                bankruptTimestamp: now
                // ▲▲▲ [핵심 버그 수정] ▲▲▲
            };

            // (선택사항) 히스토리 로그 추가
            addHistoryLogToPlayer(currentPlayerData, 
                '[파산] 파산을 신청하여 모든 자산이 초기화되었습니다. (구제금 300만, 대출 500만)', 
                'system'
            );

            // [버그 수정] 덮어쓰지 않고, *수정된* currentPlayerData를 반환
            return currentPlayerData;
        })
        .catch((error) => {
            console.error("파산 신청 트랜잭션 오류:", error);
            showAlert("파산 신청에 실패했습니다. (DB 오류)");
        });
    }
    
    function handleBankSave(type) {
        
        playerRef.transaction((currentPlayerData) => {
            if (!currentPlayerData) return;
            
            if (!currentPlayerData.bank) {
                currentPlayerData.bank = { savings: 0, savingsTimestamp: null, loan: 0, loanTimestamp: null };
            }
            let currentCash = Number(currentPlayerData.cash) || 0;
            let currentSavings = Number(currentPlayerData.bank.savings) || 0;

            // --- 1. 예금 (Save) ---
            if (type === 'save') {
                let amount = Number(els.saveAmount.value);
                if (isNaN(amount) || amount <= 0) {
                    showAlert("정확한 예금액을 입력하세요.");
                    return; 
                }
                
                // [체크 1] 대출 중 예금 방지
                if (currentPlayerData.bank.loan > 0) {
                    showAlert("대출이 있는 상태에서는 예금할 수 없습니다.");
                    return;
                }
                
                // ▼▼▼ [신규] 추가 예금 방지 로직 ▼▼▼
                if (currentSavings > 0) {
                    showAlert("이미 예금이 있습니다. 전액 인출 후 다시 시도하세요. (추가 예금 불가)");
                    return;
                }
                // ▲▲▲ [신규] ▲▲▲

                // [체크 3] 현금 부족
                if (currentCash < amount) {
                    showAlert("예금할 현금이 부족합니다.");
                    return;
                }

                currentPlayerData.cash = currentCash - amount;
                currentPlayerData.bank.savings = currentSavings + amount; // (currentSavings는 0이어야 함)
                currentPlayerData.bank.savingsTimestamp = firebase.database.ServerValue.TIMESTAMP; 
                

            // --- 2. 전액 인출 (Withdraw) ---
            } else if (type === 'withdraw') {
                if (currentSavings <= 0) {
                    showAlert("인출할 예금이 없습니다.");
                    return;
                }

                let amountToReceive = currentSavings;
                
                // (중도 인출 페널티 로직 삭제됨)

                currentPlayerData.cash = currentCash + amountToReceive;
                currentPlayerData.bank.savings = 0;
                currentPlayerData.bank.savingsTimestamp = null;
                
            }
            return currentPlayerData;
        })
        .catch((error) => {
            console.error("은행 예금/인출 트랜잭션 오류:", error);
            showAlert("은행 예금/인출에 실패했습니다. (DB 오류)");
        });
    }

    
    // === 10. Time Attack Logic ===
    
    function handleStartTimeAttack() {
        if (timeAttackTimer) {
            return showAlert("타임 어택이 이미 진행 중입니다.");
        }
        
        const confirmMsg = "30분 타임 어택을 시작하시겠습니까?<br><br>현재 게임(현금, 주식, 은행)이 안전하게 저장된 후, 초기 자본으로 새 게임을 시작합니다.";
        
        showConfirm(confirmMsg, () => {
                
            playerRef.transaction((currentPlayerData) => {
                if (!currentPlayerData) return; 

                // (중복 실행 방지)
                if (currentPlayerData.timeAttack && currentPlayerData.timeAttack.isInTimeAttack) {
                    // 여기서 return하면 .then()으로 넘어가지 않고 aborted 됩니다.
                    return; 
                }
                // (스냅샷 오류 방지)
                if (currentPlayerData.snapshot) {
                    // 이미 스냅샷이 있다는 건 이전 복구가 안 됐다는 뜻
                    return; 
                }

                // 1. 현재 게임 데이터를 'snapshot'에 백업
                const snapshotData = {
                    cash: currentPlayerData.cash,
                    stocks: currentPlayerData.stocks,
                    bank: currentPlayerData.bank
                };
                
                // 2. 새 게임 상태 로드
                const newGameState = createInitialGameState();
                
                // 3. 현재 데이터를 -> 새 게임 데이터로 덮어쓰기
                currentPlayerData.snapshot = snapshotData; 
                currentPlayerData.cash = newGameState.cash;
                currentPlayerData.stocks = newGameState.stocks;
                currentPlayerData.bank = newGameState.bank;
                
                // 4. 타임 어택 상태 설정
                currentPlayerData.timeAttack.isInTimeAttack = true;
                
                // ▼▼▼ [수정 1] 서버 시간 대신 '내 기기 시간' 사용 (리스너와 기준 통일) ▼▼▼
                currentPlayerData.timeAttack.startTime = Date.now(); 
                // ▲▲▲ [수정 1] ▲▲▲
                
                currentPlayerData.timeAttack.endTime = null;

                return currentPlayerData;
            })
            .then((result) => {
                if (result.committed) {
                    // ▼▼▼ [수정 2] UI/타이머 코드는 전부 삭제! (리스너가 알아서 함) ▼▼▼
                    showAlert("✅ 타임 어택 시작!", "30분간 초기 자본으로 최대 수익에 도전하세요.<br>기존 데이터는 안전하게 보관됩니다.");
                    
                    // 여기서 startTimeAttackTimer나 버튼 조작을 하지 마세요.
                    // 데이터가 DB에 기록되는 순간, playerRef.on 리스너가 감지하고 
                    // 자동으로 타이머를 켜고 버튼을 비활성화합니다.
                    // ▲▲▲ [수정 2] ▲▲▲
                } else {
                    // transaction 함수 내에서 return; 되어 갱신되지 않은 경우
                    showAlert("타임 어택을 시작할 수 없습니다.", "이미 진행 중이거나 데이터 오류가 있습니다.");
                }
            })
            .catch((error) => {
                console.error("타임 어택 시작 트랜잭션 오류:", error);
                showAlert("타임 어택 시작에 실패했습니다. (DB 오류)");
            });
        });
    }

    function startTimeAttackTimer(duration) {
        let remaining = duration;
        
        const updateTimerDisplay = () => {
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            els.timeAttackTimerDisplay.textContent = `남은 시간: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };
    
        
        updateTimerDisplay();

        timeAttackTimer = setInterval(() => {
            remaining--;
            updateTimerDisplay();

            if (remaining <= 0) {
                handleEndTimeAttack();
            }
        }, 1000);
    }

    function handleEndTimeAttack() {
        if (timeAttackTimer) {
            clearInterval(timeAttackTimer);
            timeAttackTimer = null;
        }
        
        playerRef.transaction((currentPlayerData) => {
            if (!currentPlayerData) return;

            // (이미 종료 처리가 된 경우 중단)
            if (!currentPlayerData.timeAttack || !currentPlayerData.timeAttack.isInTimeAttack) {
                return; 
            }
            
            // [치명적 오류 방어]
            if (!currentPlayerData.snapshot) {
                console.error("심각한 오류: 타임 어택 종료 시 스냅샷 데이터가 없습니다!");
                // (데이터 복구 불가능 -> 타임어택 상태만이라도 강제 종료)
                currentPlayerData.timeAttack.isInTimeAttack = false;
                // (점수 계산은 불가능하므로 중단)
                return currentPlayerData;
            }

            // 1. 타임 어택 계좌의 최종 자산(점수) 계산
            // (calculateNetworth는 현재 currentPlayerData를 기준으로 계산함)
            const timeAttackNetWorth = calculateNetworth(currentPlayerData, stockData);
            const score = timeAttackNetWorth - INITIAL_CASH; // 초기자본 대비 수익

            // 2. 백업해둔 스냅샷 데이터 로드
            const restoredData = currentPlayerData.snapshot;

            // 3. 현재 데이터를 -> 스냅샷 데이터로 덮어쓰기 (복원)
            currentPlayerData.cash = restoredData.cash;
            currentPlayerData.stocks = restoredData.stocks;
            currentPlayerData.bank = restoredData.bank;
            
            // 4. 스냅샷 및 타임 어택 상태 초기화
            currentPlayerData.snapshot = null; // (백업 삭제)
            currentPlayerData.timeAttack.isInTimeAttack = false;
            currentPlayerData.timeAttack.endTime = firebase.database.ServerValue.TIMESTAMP;
            currentPlayerData.timeAttack.lastScore = score; // (점수 기록)

            // 5. 리더보드에 점수 기록
            const leaderboardRef = db.ref('leaderboard').push();
            leaderboardRef.set({
                uid: currentPlayerData.uid,
                displayName: currentPlayerData.displayName,
                score: score,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });


            return currentPlayerData;
        })
        .then((result) => {
            if (result.committed) {
                // (트랜잭션 성공 -> setupPlayerListener가 복원된 UI를 자동 갱신)
                showAlert("타임 어택 종료!", `최종 점수: ${formatCurrency(state.timeAttack.lastScore)}. 기존 게임을 복구합니다.`);
                
                // (UI 정리 - setupPlayerListener가 다시 호출되며 정리하지만, 즉시 반영)
                els.timeAttackBtn.disabled = false;
                els.timeAttackBtn.textContent = `🔥 타임 어택 (${TIME_ATTACK_DURATION / 60}분)`;
                els.timeAttackTimerDisplay.classList.add('hidden');
                els.timeAttackCancelBtn.classList.add('hidden');
            } else {
                 console.log("타임 어택 종료 트랜잭션이 중단되었습니다.");
            }
        })
        .catch((error) => {
            console.error("타임 어택 종료 트랜잭션 오류:", error);
            showAlert("타임 어택 종료/복원에 실패했습니다. (DB 오류)");
        });
    }

    function handleCancelTimeAttack() {
    if (!state.timeAttack || !state.timeAttack.isInTimeAttack) return;

        showConfirm("타임 어택을 취소하시겠습니까?", () => {
            // ▼ UI/타이머 조작 코드 제거! (리스너가 알아서 함) ▼
            // if (timeAttackTimer) clearInterval(timeAttackTimer); (삭제 가능)
            
            playerRef.transaction((currentPlayerData) => {
                if (!currentPlayerData) return;
                
                // 스냅샷 복구 로직 (이전과 동일)
                if (currentPlayerData.snapshot) {
                    const restored = currentPlayerData.snapshot;
                    currentPlayerData.cash = restored.cash;
                    currentPlayerData.stocks = restored.stocks;
                    currentPlayerData.bank = restored.bank;
                    currentPlayerData.snapshot = null;
                }
                
                // ★ 핵심: 상태만 바꾸면 리스너가 알아서 "꺼짐" 상태로 전환함
                currentPlayerData.timeAttack.isInTimeAttack = false;
                currentPlayerData.timeAttack.startTime = null;
                currentPlayerData.timeAttack.endTime = null;
                
                return currentPlayerData;
            }).then(() => {
                showAlert("타임 어택이 취소되었습니다.");
                // els.timeAttackBtn... 등의 UI 조작도 리스너의 else 블록에서 처리되므로 제거 가능
            });
        });
    }

        // === 11. Ranking Logic ===

        // 1. (총 자산) 'players' 노드 전체를 감시
        function setupNetWorthListener() {
            const playersRef = db.ref('players');
            playersRef.on('value', (snapshot) => {
                allPlayersData = snapshot.val() || {}; // 모든 플레이어 데이터 전역 저장
                updateNetWorthRankings(); // 플레이어 데이터 변경 시 랭킹 갱신
            });
        }

    // 2. (타임 어택) 'leaderboard' 노드를 감시
    function setupTimeAttackListener() {
        const leaderboardRef = db.ref('leaderboard').orderByChild('score').limitToLast(100);
        
        leaderboardRef.on('value', (snapshot) => {
            const leaderboardData = snapshot.val();
            if (!leaderboardData) return;

            const rankings = [];
            snapshot.forEach((childSnapshot) => {
                const entry = childSnapshot.val();
                rankings.push({
                    name: entry.displayName || "Anonymous",
                    score: entry.score
                });
            });
            
            timeAttackRankings = rankings.reverse(); // 내림차순 정렬
            
            if (currentRankView === 'timeattack') {
                renderRankings();
            }
        });
    }

    // 3. (총 자산) 랭킹 계산 함수
    function updateNetWorthRankings() {
        if (!allPlayersData || !Object.keys(stockData).length) {
            return; // 데이터 미비
        }
        
        const rankings = [];
        for (const uid in allPlayersData) {
            const player = allPlayersData[uid];
            if (!player.bank || !player.stocks) continue; // 필수 데이터 체크
            
            const netWorth = calculateNetworth(player, stockData); 
            rankings.push({
                name: player.displayName || "Anonymous",
                score: netWorth
            });
        }
        
        rankings.sort((a, b) => b.score - a.score);
        netWorthRankings = rankings;
        
        if (currentRankView === 'networth') {
            renderRankings();
        }
    }

    // 4. 랭킹 탭 전환 함수
    function switchRankView(view) {
        if (view === currentRankView) return; 
        currentRankView = view;
        
        if (view === 'networth') {
            els.showNetWorthRankBtn.classList.add('bg-indigo-600', 'text-white');
            els.showNetWorthRankBtn.classList.remove('bg-white', 'text-slate-500');
            els.showTimeAttackRankBtn.classList.add('bg-white', 'text-slate-500');
            els.showTimeAttackRankBtn.classList.remove('bg-indigo-600', 'text-white');
        } else {
            els.showTimeAttackRankBtn.classList.add('bg-indigo-600', 'text-white');
            els.showTimeAttackRankBtn.classList.remove('bg-white', 'text-slate-500');
            els.showNetWorthRankBtn.classList.add('bg-white', 'text-slate-500');
            els.showNetWorthRankBtn.classList.remove('bg-indigo-600', 'text-white');
        }
        
        renderRankings();
    }
    
    // 5. 랭킹 UI 렌더링 함수
    function renderRankings() {
        if (!els.rankingList) return; // 모달이 아직 바인딩 안됐으면 중지
        
        els.rankingList.innerHTML = ''; 
        const rankingsToDisplay = (currentRankView === 'networth') ? netWorthRankings : timeAttackRankings;
        
        if (rankingsToDisplay.length === 0) {
            els.rankingList.innerHTML = `<p class="text-slate-500 text-sm">표시할 랭킹이 없습니다.</p>`;
            return;
        }

        rankingsToDisplay.slice(0, 100).forEach((entry, index) => {
            const rankItem = document.createElement('div');
            rankItem.className = 'flex justify-between items-center text-sm py-1';
            
            let medal = '';
            if (index === 0) medal = '🥇';
            else if (index === 1) medal = '🥈';
            else if (index === 2) medal = '🥉';
            else medal = `<span class="text-xs w-4 text-right">${index + 1}</span>`; 
            
            rankItem.innerHTML = `
                <div class="font-bold w-12">${medal}</div>
                <div class="flex-1 font-medium text-slate-700 truncate" title="${entry.name}">${entry.name}</div>
                <div class="font-mono text-slate-900 ml-2">${formatCurrency(entry.score)}</div>
            `;
            els.rankingList.appendChild(rankItem);
        });
    }
    
    // 6. 랭킹 모달 표시/숨김
    function showRankingModal() {
        renderRankings(); // 모달 열 때 랭킹 갱신
        els.rankingModal.classList.remove('hidden');
        els.rankingModal.classList.add('flex');
    }
    
    function hideRankingModal() {
        els.rankingModal.classList.add('hidden');
        els.rankingModal.classList.remove('flex');
    }

    // 관리자 모달 표시/숨김
    function showAdminModal() {
        els.adminModal.classList.remove('hidden');
        els.adminModal.classList.add('flex');
    }
    
    function hideAdminModal() {
        els.adminModal.classList.add('hidden');
        els.adminModal.classList.remove('flex');
    }

    
    // === 12. UI Update Logic ===

    /**
     * 메인 UI 업데이트 (플레이어 데이터 기준)
     */

    function updateUI() {
        if (!state || !els.cash) return;
        
        els.cash.textContent = formatCurrency(state.cash);

        if (els.bankModalCash) {
             els.bankModalCash.textContent = formatCurrency(state.cash);
        }

        if (els.maxLoanInfo) {
            const maxLoan = (Number(state.cash) || 0) * 3;
            els.maxLoanInfo.textContent = formatCurrency(maxLoan);
        }

        if (els.totalGrossHoldings) {
            els.totalGrossHoldings.textContent = formatCurrency(calculateGrossHoldings(state, stockData));
        }

        if (els.totalNetWorth) {
            // (calculateNetworth는 이제 '총 자산'을 계산함)
            els.totalNetWorth.textContent = formatCurrency(calculateNetworth(state, stockData));
        }
        updateHistoryUI();
        updatePortfolioUI();
        
    }

    /**
     * 포트폴리오 UI 갱신 (가장 빈번)
     */
    function updatePortfolioUI() {
        if (!state.stocks || !stockData) return;
        
        els.portfolioList.innerHTML = '';
        let currentStockValue = 0;
        
        Object.keys(state.stocks).forEach(ticker => {
            const stock = state.stocks[ticker];
            if (stock.shares > 0) {
                const market = stockData[ticker];
                const price = (market && !market.isDelisted) ? market.price : 0;
                const value = price * stock.shares;
                currentStockValue += value;
                
                const avgPrice = stock.averagePrice || 0;
                const profit = (price - avgPrice) * stock.shares;
                const profitRate = (avgPrice > 0) ? (profit / (avgPrice * stock.shares)) * 100 : 0;
                
                const color = profit > 0 ? 'text-red-600' : (profit < 0 ? 'text-blue-600' : 'text-slate-500');

                const item = document.createElement('div');
                item.className = 'border-t border-slate-200 pt-3';
                item.innerHTML = `
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-slate-800">${allTickerNames[ticker] || ticker}</span>
                        <span class="font-mono font-bold ${color}">${formatCurrency(value)}</span>
                    </div>
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-slate-500">${stock.shares}주 (평단 ${formatCurrency(avgPrice)})</span>
                        <span class="font-mono ${color}">${formatCurrency(profit)} (${profitRate.toFixed(2)}%)</span>
                    </div>
                `;
                item.onclick = () => selectTicker(ticker);
                els.portfolioList.appendChild(item);
            }
        });

        els.stockValue.textContent = formatCurrency(currentStockValue);
        
        // 총 자산 (calculateNetworth 사용)
        const netWorth = calculateNetworth(state, stockData);
        els.totalHoldings.textContent = formatCurrency(netWorth);
    }

    function updateHistoryUI() {
        if (!state.history) return;
        els.log.innerHTML = '';
        state.history.forEach(log => {
            const p = document.createElement('p');
            p.textContent = log;
            if (log.includes('[매수]')) p.className = 'text-red-700';
            else if (log.includes('[매도]')) p.className = 'text-blue-700';
            else if (log.includes('[은행]')) p.className = 'text-blue-700';
            els.log.appendChild(p);
        });
    }
    
    function updateBankTimerUI() {
        if (!state || !state.bank) {
            return; 
        }

        const bank = state.bank;
        const now = Date.now();
        const TEN_MINUTES_MS = 10 * 60 * 1000;

        // --- 1. 예금 정보 갱신 (10분) ---
        if (els.bankSavingsAmount) {
            const savings = Number(bank.savings) || 0; // 예금 원금
            const savingsTime = bank.savingsTimestamp; // 예금 시작 시간

            els.bankSavingsAmount.textContent = formatCurrency(savings);

            const INTEREST_RATE = 0.02; 

            if (savings <= 0 || !savingsTime) {
                els.bankNextInterestTimer.textContent = "--:--";
                els.bankNextInterest.textContent = "+ 0"; // 예상 이자도 0으로
                // ----------------------------------------------------
            } else {
                const elapsedMs = now - savingsTime;
                const elapsedMsInCycle = elapsedMs % TEN_MINUTES_MS;
                const remainingMsInCycle = TEN_MINUTES_MS - elapsedMsInCycle;
                
                const remainingSeconds = Math.floor(remainingMsInCycle / 1000);
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = remainingSeconds % 60;

                // 10:00 (시작) ~ 00:00 (거의 도달) 형태로 표시
                // (참고: 10분이 딱 되는 0.001초간 10:00으로 표시될 수 있음)
                if (minutes === 10 && seconds === 0) {
                    els.bankNextInterestTimer.textContent = "10:00";
                } else {
                    els.bankNextInterestTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
                const periodsPassed = Math.floor(elapsedMs / TEN_MINUTES_MS);
                
                const currentValue = savings * Math.pow((1 + INTEREST_RATE), periodsPassed);
                
                const nextInterest = currentValue * INTEREST_RATE;
                
                // (소수점 버림)
                els.bankNextInterest.textContent = `+ ${formatCurrency(Math.floor(nextInterest))}`;
                // ----------------------------------------------------
            }
        }

        // --- 2. 대출 정보 갱신 (상환금 / 10분 쿨타임) ---
        if (els.bankLoanAmount) {
            const loan = Number(bank.loan) || 0;
            const repayTime = bank.loanRepayTimestamp;

            els.bankLoanAmount.textContent = formatCurrency(loan);
            els.bankRepaymentAmount.textContent = formatCurrency(loan); 

            if (loan > 0) {
                els.bankNextLoanTimer.textContent = "대출 상환 필요";
            } else {
                if (!repayTime) {
                    els.bankNextLoanTimer.textContent = "대출 가능";
                } else {
                    const elapsedMs = now - repayTime;
                    const remainingMs = TEN_MINUTES_MS - elapsedMs;

                    if (remainingMs <= 0) {
                        els.bankNextLoanTimer.textContent = "대출 가능";
                    } else {
                        const remainingSeconds = Math.floor(remainingMs / 1000);
                        const minutes = Math.floor(remainingSeconds / 60);
                        const seconds = remainingSeconds % 60;
                        els.bankNextLoanTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    }
                }
            }
        }
        
        // ▼▼▼ [신규] 3. 파산 쿨타임 갱신 (10분) ▼▼▼
        if (els.bankruptCooldownTimer) {
            const bankruptTime = bank.bankruptTimestamp;

            if (!bankruptTime) {
                // (파산한 적 없음)
                els.bankruptCooldownTimer.textContent = "신청 가능";
            } else {
                // (파산 기록이 있음)
                const elapsedMs = now - bankruptTime;
                const remainingMs = TEN_MINUTES_MS - elapsedMs;

                if (remainingMs <= 0) {
                    // (쿨타임 10분 지남)
                    els.bankruptCooldownTimer.textContent = "신청 가능";
                } else {
                    // (쿨타임 남음)
                    const remainingSeconds = Math.floor(remainingMs / 1000);
                    const minutes = Math.floor(remainingSeconds / 60);
                    const seconds = remainingSeconds % 60;
                    els.bankruptCooldownTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            }
        }
        // ▲▲▲ [신규] 3. 파산 로직 끝 ▲▲▲
    }

    function formatTimeAgo(timestamp) {
        const now = Date.now();
        const seconds = Math.floor((now - timestamp) / 1000);

        let interval = seconds / 31536000; // 1년 (초)
        if (interval > 1) {
            return Math.floor(interval) + "년 전";
        }
        interval = seconds / 2592000; // 1달
        if (interval > 1) {
            return Math.floor(interval) + "달 전";
        }
        interval = seconds / 86400; // 1일
        if (interval > 1) {
            return Math.floor(interval) + "일 전";
        }
        interval = seconds / 3600; // 1시간
        if (interval > 1) {
            return Math.floor(interval) + "시간 전";
        }
        interval = seconds / 60; // 1분
        if (interval > 1) {
            return Math.floor(interval) + "분 전";
        }
        return "방금 전";
    }

    function updateNewsBoxUI(newsData) {
        if (!els.newsBox) {
            return;
        }

        // "개발 중입니다..." <p> 태그를 포함한 기존 내용 비우기
        els.newsBox.innerHTML = ''; 

        if (!newsData) {
            const p = document.createElement('p');
            p.className = "text-slate-500"; // 기존 스타일과 일치
            p.textContent = "현재 뉴스가 없습니다.";
            els.newsBox.appendChild(p);
            return;
        }

        // 1. DB 객체를 배열로 변환
        const newsArray = Object.values(newsData);
        
        // 2. 최신순(timestamp 내림차순)으로 정렬
        newsArray.sort((a, b) => b.timestamp - a.timestamp);
        
        // 3. 최근 15개만 표시 (h-64 스크롤을 고려)
        const recentNews = newsArray.slice(0, 15);

        // 4. HTML 생성 (id="newsBox"는 space-y-3 클래스가 있으므로 div로 감싸기)
        recentNews.forEach(news => {
            
            // 각 뉴스를 감싸는 div (space-y-3의 자식 요소)
            const newsItemDiv = document.createElement('div');
            
            // (XSS 방지를 위해 textContent 사용)
            const messageP = document.createElement('p');
            messageP.className = "text-sm text-slate-700"; // 기존 스타일과 일치
            messageP.textContent = news.message;
            
            const timeP = document.createElement('p');
            timeP.className = "text-xs text-slate-500 mt-1";
            timeP.textContent = formatTimeAgo(news.timestamp);

            newsItemDiv.appendChild(messageP);
            newsItemDiv.appendChild(timeP);
            els.newsBox.appendChild(newsItemDiv);
        });
    }

    /**
     * 종목 리스트 탭 전환
     */
    function switchView(view) {
        currentView = view;
        
        // 탭 스타일 업데이트
        // [수정] showCoinsBtn 추가
        [els.showStocksBtn, els.showAssetsBtn, els.showBondsBtn, els.showCoinsBtn, els.showMiscBtn].forEach(btn => {
            btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
            btn.classList.add('bg-white', 'text-slate-500', 'hover:bg-slate-100');
        });
        
        let activeBtn;
        if (view === 'stocks') activeBtn = els.showStocksBtn;
        else if (view === 'assets') activeBtn = els.showAssetsBtn;
        else if (view === 'bonds') activeBtn = els.showBondsBtn;
        else if (view === 'coins') activeBtn = els.showCoinsBtn; // <-- [신규] 코인 뷰
        else activeBtn = els.showMiscBtn;
        
        activeBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
        activeBtn.classList.remove('bg-white', 'text-slate-500', 'hover:bg-slate-100');
        
        renderStockList();
    }
    
    /**
     * 종목 리스트 렌더링
     */
    function renderStockList() {
        if (!els.stockSelector) return;
        els.stockSelector.innerHTML = '';
        
        let tickersToShow = [];
        if (currentView === 'stocks') tickersToShow = STOCK_TICKERS;
        else if (currentView === 'assets') tickersToShow = ASSET_TICKERS;
        else if (currentView === 'bonds') tickersToShow = BOND_TICKERS;
        else if (currentView === 'coins') tickersToShow = COIN_TICKERS; 
        else tickersToShow = MISC_TICKERS;

        tickersToShow.forEach(ticker => {
            const market = stockData[ticker];
            if (!market) return; 
            
            // [신규] 상장폐지 여부 확인
            const isDelisted = market.isDelisted || false;
            
            const price = market.price || 0;
            const change = price - (market.prevPrice || price);
            const changeRate = (market.prevPrice > 0) ? (change / market.prevPrice) * 100 : 0;
            
            const color = change > 0 ? 'text-red-600' : (change < 0 ? 'text-blue-600' : 'text-slate-500');
            
            // [수정] 상장폐지 시 회색 처리
            const priceColor = isDelisted ? 'text-slate-400' : color;
            const changeColor = isDelisted ? 'text-slate-400' : (change === 0 ? 'text-slate-500' : color); // (0일 때도 회색)
            const nameColor = isDelisted ? 'text-slate-400' : 'text-slate-800';
            
            const isActive = (ticker === currentTicker) ? 'bg-indigo-100 border-indigo-500' : 'border-transparent hover:bg-slate-50';

            const item = document.createElement('div');
            item.className = `p-3 rounded-lg border ${isActive} cursor-pointer transition-colors`;

            // [신규] 상장폐지 배지
            const delistedBadge = isDelisted ? '<span class="text-xs font-bold text-red-600">(거래정지)</span>' : '';

            item.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="font-bold text-sm ${nameColor}">${market.name || ticker} ${delistedBadge}</span>
                    <span class="font-mono font-bold text-sm ${priceColor}">${formatCurrency(price)}</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                    <span class="text-slate-500">${ticker}</span>
                    <span class="font-mono ${changeColor}">${isDelisted ? '(--.--%)' : (change > 0 ? '+' : '') + changeRate.toFixed(2) + '%'}</span>
                </div>
            `;
            item.onclick = () => selectTicker(ticker);
            els.stockSelector.appendChild(item);
        });
    }

    /**
     * 종목 선택 시
     */
    function selectTicker(ticker) {
        currentTicker = ticker;
        renderStockList(); // 활성 종목 UI 갱신
        updateStockInfoUI(); // 차트 및 정보 갱신
    }

    /**
     * 주식 정보 (차트 위) 갱신
     */
    function updateStockInfoUI() {
        const market = stockData[currentTicker];
        
        // [수정] market이 없거나, 'isDelisted'일 경우 처리
        if (!market || market.isDelisted) {
            
            // [신규] 상장폐지 UI 처리
            if (market && market.isDelisted) {
                els.stockName.textContent = market.name;
                els.stockTicker.textContent = currentTicker;
                els.price.textContent = "₩--";
                
                // ▼▼▼ [신규] 남은 시간 계산 타이머 ▼▼▼
                const delistTimestamp = market.delistTimestamp;
                
                if (delistTimestamp) {
                    const now = Date.now();
                    const elapsed = now - delistTimestamp;
                    const remainingMs = DELIST_DURATION_MS - elapsed;
                    
                    if (remainingMs <= 0) {
                        els.change.textContent = "(복구 처리 중...)";
                    } else {
                        // 남은 시간을 MM:SS 형식으로 변환
                        const remainingSeconds = Math.floor(remainingMs / 1000);
                        const minutes = Math.floor(remainingSeconds / 60);
                        const seconds = remainingSeconds % 60;
                        const timerString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        els.change.textContent = `(복구까지 ${timerString})`;
                    }
                } else {
                    els.change.textContent = "(거래 정지)"; // 타임스탬프가 아직 없으면
                }
                // ▲▲▲ [신규] ▲▲▲
                
                els.price.className = `text-3xl font-bold text-slate-400`;
                els.change.className = `text-base font-medium text-red-600`;
                
                // (거래 버튼 비활성화)
                els.buyBtn.disabled = true;
                els.buyMaxBtn.disabled = true;
                els.sellBtn.disabled = true;
                
                updateChartData(market.history || []);
                return; // 함수 종료
            }

            // (market이 아예 없는 경우 - 기존 로직)
            if (currentTicker === 'SAFE') { 
                currentTicker = 'AAPL';
                selectTicker('AAPL');
            }
            return;
        }
        
        // (거래 버튼 활성화 - 이미 정지된 것을 선택했다가 복귀했을 때를 대비)
        els.buyBtn.disabled = false;
        els.buyMaxBtn.disabled = false;
        els.sellBtn.disabled = false;

        els.stockName.textContent = market.name;
        els.stockTicker.textContent = currentTicker;
        
        const price = market.price || 0;
        const change = price - (market.prevPrice || price);
        const changeRate = (market.prevPrice > 0) ? (change / market.prevPrice) * 100 : 0;
        
        const color = change > 0 ? 'text-red-600' : (change < 0 ? 'text-blue-600' : 'text-slate-500');
        const sign = change > 0 ? '▲' : (change < 0 ? '▼' : '');
        
        els.price.textContent = formatCurrency(price);
        els.change.textContent = `${sign} ${formatCurrency(change)} (${changeRate.toFixed(2)}%)`;
        els.price.className = `text-3xl font-bold ${color}`;
        els.change.className = `text-base font-medium ${color}`;
        
        updateChartData(market.history || []);
    }

    function calculateGrossHoldings(playerState, marketData) {
        let cash = Number(playerState.cash) || 0;
        let savings = Number(playerState.bank ? playerState.bank.savings : 0) || 0;
        
        let stockValue = 0;
        if (playerState.stocks) {
            for (const ticker in playerState.stocks) {
                const stock = playerState.stocks[ticker];
                // (거래 정지/상폐가 아니며, 가격 정보가 있는 주식만 계산)
                if (stock && stock.shares > 0 && marketData[ticker] && !marketData[ticker].isDelisted && typeof marketData[ticker].price === 'number') {
                    stockValue += stock.shares * marketData[ticker].price;
                }
            }
        }
        
        // [신규] 현금 + 주식 + 예금
        const grossHoldings = cash + stockValue + savings;
        return grossHoldings;
    }

    /**
     * 거래 내역 UI 갱신
     */
    function updateHistoryUI() {
        if (!state.history) return;
        els.log.innerHTML = '';
        state.history.forEach(log => {
            const p = document.createElement('p');
            p.textContent = log;
            if (log.includes('[매수]')) p.className = 'text-red-700';
            else if (log.includes('[매도]')) p.className = 'text-blue-700';
            else if (log.includes('[은행]')) p.className = 'text-blue-700';
            els.log.appendChild(p);
        });
    }
    
    
    // === 13. Chart Logic ===
    
    function initChart() {
        if (!els.chart) return;
        const ctx = els.chart.getContext('2d');
        
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '주가',
                    data: [],
                    borderColor: 'rgba(79, 70, 229, 1)', // Indigo-600
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: { display: false },
                        grid: { display: false }
                    },
                    y: {
                        position: 'right',
                        ticks: { 
                            callback: (value) => `${formatCurrency(value, 0)}`
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${formatCurrency(context.parsed.y)}`
                        }
                    }
                }
            }
        });
    }

    function updateChartData(history) {
        if (!chartInstance) return;
        
        chartInstance.data.labels = history.map((_, index) => index);
        chartInstance.data.datasets[0].data = history;
        chartInstance.update('none'); // 애니메이션 없이 업데이트
    }
    

    // === 14. Helper Functions ===
    
    /**
     * 숫자 -> 통화 형식 (₩1,234)
     */
    function formatCurrency(value, decimals = 0) {
        const num = Number(value);
        if (isNaN(num)) {
            return "₩--"; // NaN 방어
        }
        return "₩" + num.toLocaleString('ko-KR', { 
            minimumFractionDigits: decimals, 
            maximumFractionDigits: decimals 
        });
    }

    /**
     * [랭킹용] 총 자산 계산기
     */
    function calculateNetworth(playerState, marketData) {
        
        let cash = Number(playerState.cash) || 0;
        let savings = Number(playerState.bank ? playerState.bank.savings : 0) || 0;
        let loan = Number(playerState.bank ? playerState.bank.loan : 0) || 0;
        
        let stockValue = 0;
        if (playerState.stocks) {
            for (const ticker in playerState.stocks) {
                const stock = playerState.stocks[ticker];
                if (stock && stock.shares > 0 && marketData[ticker] && !marketData[ticker].isDelisted && typeof marketData[ticker].price === 'number') {
                    stockValue += stock.shares * marketData[ticker].price;
                }
            }
        }
        
        // [오류 발생 지점] 여기서 'savings'를 찾지 못해서 오류가 났습니다.
        const networth = (cash + stockValue + savings) - loan;
        return networth;
    }

    /**
     * [최종 수정본] 거래 내역 추가 (TypeError 방어)
     */
    function addHistoryLogToPlayer(currentPlayerData, logMessage, type) {
        try {
            // [핵심 방어] history가 배열이 아니면 강제로 새 빈 배열로 초기화
            if (!Array.isArray(currentPlayerData.history)) {
                currentPlayerData.history = [];
            }

            currentPlayerData.history.unshift(logMessage);

            const maxLogs = typeof MAX_HISTORY_LOG !== 'undefined' ? MAX_HISTORY_LOG : 100;
            
            while (currentPlayerData.history.length > maxLogs) {
                currentPlayerData.history.pop();
            }

        } catch (e) {
            console.error("addHistoryLogToPlayer 함수 실패:", e);
            // (트랜잭션 자체는 중단시키지 않음)
        }
    }

    // (알림/확인 모달 함수들)
    let alertCallback = null;
    function showAlert(message, callback = null) {
        els.alertMessage.textContent = message;
        els.alertModal.classList.remove('hidden');
        els.alertModal.classList.add('flex');
        alertCallback = callback;
    }
    function hideAlert() {
        els.alertModal.classList.add('hidden');
        els.alertModal.classList.remove('flex');
        if (alertCallback) {
            alertCallback();
            alertCallback = null;
        }
    }
    
    let confirmResolve = null;
    function showConfirm(message, onOk) {
        // [수정] textContent -> innerHTML
        // (줄바꿈 <br> 태그를 렌더링하기 위함)
        els.confirmMessage.innerHTML = message;
        
        els.confirmModal.classList.remove('hidden');
        els.confirmModal.classList.add('flex');
        
        // (이벤트 리스너가 중첩되는 것을 방지하기 위해, 기존 리스너를 제거하고 새로 만듦)
        els.confirmOkBtn.replaceWith(els.confirmOkBtn.cloneNode(true));
        els.confirmCancelBtn.replaceWith(els.confirmCancelBtn.cloneNode(true));
        
        // (새로 바인딩)
        els.confirmOkBtn = document.getElementById('confirmOkBtn');
        els.confirmCancelBtn = document.getElementById('confirmCancelBtn');

        els.confirmOkBtn.onclick = () => {
            hideConfirm();
            onOk(); // 확인 콜백 실행
        };
        els.confirmCancelBtn.onclick = hideConfirm;
    }

    function hideConfirm() {
        els.confirmModal.classList.add('hidden');
        els.confirmModal.classList.remove('flex');
    }

    
    // === 15. Initial State Creation ===

    function createInitialGameState() {
        const initialPlayerStocks = {};
        allTickers.forEach(ticker => {
            initialPlayerStocks[ticker] = { shares: 0, averagePrice: 0 };
        });

        return {
            cash: INITIAL_CASH,
            bank: {
                checking: 0, savings: 0, loan: 0,
                savingsTimestamp: null, loanTimestamp: null
            },
            stocks: initialPlayerStocks
        };
    }

    /**
     * [수정] 새 플레이어 상태 (allTickers 사용)
     */
    function createInitialPlayerState(user) {
        // [수정] 새 헬퍼 함수를 호출하여 초기 게임 데이터를 가져옴
        const initialGameState = createInitialGameState();

        return {
            uid: user.uid, 
            displayName: user.displayName || "Anonymous User", 
            email: user.email || null,
            
            // (Helper 함수가 생성한 데이터)
            cash: initialGameState.cash,
            bank: initialGameState.bank,
            stocks: initialGameState.stocks, 
            
            history: ["Firebase 멀티플레이어 게임에 오신 것을 환영합니다!"],

            bank: {
            savings: 0,
            savingsTimestamp: null,
            loan: 0,
            loanTimestamp: null,
            loanRepayTimestamp: null, // [신규] 대출 상환 쿨타임용
            bankruptTimestamp: null
            },
            
            timeAttack: {
                isInTimeAttack: false, // 현재 타임 어택 중인지
                startTime: null, 
                endTime: null,
                lastScore: 0
            },
            snapshot: null 
        };
    }
    
    /**
     * [수정] 새 마켓 상태 (새 티커 이름 사용)
     */
    function createInitialMarketState() {
        const createStock = (name, price, volatility, eventChance, riseProb) => ({
            name, price, prevPrice: price, 
            initialPrice: price, // '시작 가격'
            history: Array(MAX_HISTORY).fill(price),
            consecutiveRises: 0, consecutiveFalls: 0,
            baseVolatility: volatility,     
            bigEventChance: eventChance,    
            baseRiseProbability: riseProb,  
            isDelisted: false,
            delistTimestamp: null
        });

        // (밸런스는 임의로 설정)
        const marketStocks = {
            // --- 주식 (30개) ---
            'AAPL': createStock('Apple (애플)', 18000, 0.02, 0.03, 0.53), // 0.51 -> 0.53
            'MSFT': createStock('Microsoft (마이크로소프트)', 35000, 0.018, 0.02, 0.514), // 0.52 -> 0.54
            'GOOGL': createStock('Alphabet (구글)', 14000, 0.02, 0.03, 0.53), // 0.51 -> 0.53
            'AMZN': createStock('Amazon (아마존)', 15000, 0.025, 0.04, 0.53), // 0.51 -> 0.53
            'NVDA': createStock('NVIDIA (엔비디아)', 45000, 0.04, 0.08, 0.53), // 0.53 -> 0.54
            'META': createStock('Meta Platforms (메타)', 30000, 0.035, 0.06, 0.53), // 0.50 -> 0.52
            'TSLA': createStock('Tesla (테슬라)', 25000, 0.05, 0.1, 0.53), // 0.50 -> 0.52
            'BRK-B': createStock('Berkshire Hathaway B (버크셔 해서웨이 B)', 36000, 0.01, 0.01, 0.515), // 0.52 -> 0.54
            'V': createStock('Visa (비자)', 24000, 0.015, 0.02, 0.53), // 0.52 -> 0.54
            'JNJ': createStock('Johnson & Johnson (존슨 앤 존슨)', 16000, 0.01, 0.01, 0.53), // 0.51 -> 0.53
            'XOM': createStock('Exxon Mobil (엑슨모빌)', 11000, 0.018, 0.03, 0.53), // 0.51 -> 0.53
            'JPM': createStock('JPMorgan Chase (JP모건 체이스)', 15000, 0.017, 0.02, 0.53), // 0.51 -> 0.53
            'TSM': createStock('TSMC (TSMC)', 10000, 0.03, 0.05, 0.54), // 0.52 -> 0.54
            'NFLX': createStock('Netflix (넷플릭스)', 40000, 0.035, 0.06, 0.53), // 0.50 -> 0.52
            'SBUX': createStock('Starbucks (스타벅스)', 10000, 0.02, 0.03, 0.53), // 0.51 -> 0.53
            'NKE': createStock('Nike (나이키)', 11000, 0.022, 0.04, 0.53), // 0.51 -> 0.53
            'MCD': createStock("McDonald's (맥도날드)", 28000, 0.012, 0.01, 0.53), // 0.51 -> 0.53
            'KO': createStock('Coca-Cola (코카콜라)', 6000, 0.01, 0.01, 0.54), // 0.52 -> 0.54
            'DIS': createStock('Disney (디즈니)', 9000, 0.025, 0.04, 0.535), // 0.50 -> 0.52
            'VT': createStock('Vanguard Total World ETF (뱅가드 토탈 월드 ETF)', 10000, 0.008, 0.01, 0.53), // 0.51 -> 0.53
            'PG': createStock('Procter & Gamble (P&G)', 16000, 0.01, 0.01, 0.53), // 0.51 -> 0.53
            'WMT': createStock('Walmart (월마트)', 15000, 0.012, 0.01, 0.53), // 0.51 -> 0.53
            'COST': createStock('Costco (코스트코)', 50000, 0.015, 0.02, 0.52), // 0.52 -> 0.54
            'PEP': createStock('PepsiCo (펩시코)', 17000, 0.01, 0.01, 0.53), // 0.51 -> 0.53
            'HD': createStock('Home Depot (홈디포)', 30000, 0.017, 0.02, 0.53), // 0.51 -> 0.53
            'SEC': createStock('삼성전자 (Samsung Elec.)', 75000, 0.018, 0.03, 0.515), // 0.52 -> 0.54
            'SKH': createStock('SK하이닉스 (SK Hynix)', 20000, 0.025, 0.05, 0.53), // 0.51 -> 0.53
            'LGES': createStock('LG에너지솔루션 (LG Energy Solution)', 35000, 0.03, 0.06, 0.535), // 0.50 -> 0.52
            'HYMT': createStock('현대자동차 (Hyundai Motor)', 25000, 0.02, 0.04, 0.53), // 0.51 -> 0.53
            'NAVER': createStock('네이버 (NAVER)', 17000, 0.035, 0.07, 0.535), // 0.50 -> 0.52

            // --- 실물자산 (ASSETS) ---
            'GOLD': createStock('금 (Gold)', 20000, 0.015, 0.02, 0.55), // 0.51 -> 0.53
            'SLVR': createStock('은 (Silver)', 2500, 0.025, 0.04, 0.544), // 0.50 -> 0.52
            'OIL': createStock('WTI 원유 (Crude Oil)', 8000, 0.035, 0.08, 0.544), // 0.50 -> 0.52
            'NGAS': createStock('천연가스 (Natural Gas)', 3000, 0.095, 0.15, 0.544), // 0.50 -> 0.52
            'COPR': createStock('구리 (Copper)', 8500, 0.025, 0.055, 0.545), // 0.51 -> 0.53
            'WHEAT': createStock('밀 (Wheat)', 6000, 0.05, 0.105, 0.545), // 0.50 -> 0.52

            // --- 채권 (BONDS) ---
            'BOND_L': createStock('미국 장기채 (US Long Bond)', 10000, 0.007, 0.01, 0.6), // 0.505 -> 0.525
            'BOND_S': createStock('미국 단기채 (US Short Bond)', 5000, 0.005, 0.00, 0.6), // 0.51 -> 0.53
            'CORP_B': createStock('미국 회사채 (Corp. Bond)', 9000, 0.01, 0.01, 0.6), // 0.51 -> 0.53
            'HY_B': createStock('하이일드 채권 (High-Yield)', 7000, 0.015, 0.03, 0.6), // 0.50 -> 0.52

            // --- 코인 (COINS) ---
            'BTC': createStock('비트코인 (Bitcoin)', 600000, 0.08, 0.15, 0.515), // 0.50 -> 0.52
            'ETH': createStock('이더리움 (Ethereum)', 3000, 0.10, 0.18, 0.513), // 0.50 -> 0.52
            'DOGE': createStock('도지코인 (Dogecoin)', 1000, 0.20, 0.30, 0.515), // 0.50 -> 0.52
            'SOL': createStock('솔라나 (Solana)', 1500, 0.15, 0.25, 0.515), // 0.50 -> 0.52
            
            // --- 기타 (MISC) ---
            'DEV_MOOD': createStock('개발자 기분 (Dev Mood)', 1000, 0.0, 0.0, 0), // 0.50 -> 0.52
            'SONG': createStock('송송그룹 (Song)', 100000, 0.12, 0.05, 0.529),
            'COOKIE': createStock('쿠키컴퍼니 (CookieCo)', 7500, 0.25, 0.3, 0.529)
        };
        return marketStocks;
    }
    /**
     * (루프) 모든 마켓 가격 갱신 (트랜잭션 사용)
     */
    function updateStockPrices() {
        // 상패 기록용
        const now = Date.now();

        marketRef.child('stocks').transaction((currentMarketData) => {
            if (!currentMarketData) {
                return createInitialMarketState(); 
            }
            // --- 상패 관련 상수 ---
            const DELIST_PERCENT = 0.05; // 5% (시작 가격 대비)
            
            // --- [수정] 평균 회귀(Mean Reversion) 상수 설정 ---
            
            // --- [수정] 평균 회귀(Mean Reversion) 상수 설정 ---
            const REVERSION_STRENGTH_DOWN = 0.05; 
            const MIN_RISE_PROBABILITY = 0.1;     
            const REVERSION_STRENGTH_UP = 0.1;    
            const MAX_RISE_PROBABILITY = 0.9;
            
            Object.keys(currentMarketData).forEach(ticker => {
                const stock = currentMarketData[ticker];
                if (stock.isDelisted) {
                    // 10분이 지났는지 확인
                    // (stock.delistTimestamp가 null일 경우를 대비해 (stock.delistTimestamp || now) 사용)
                    const timeElapsed = now - (stock.delistTimestamp || now);
                    
                    if (timeElapsed >= DELIST_DURATION_MS) {
                        // 10분 경과: 주식 복귀
                        stock.isDelisted = false;
                        stock.delistTimestamp = null;
                        stock.price = stock.initialPrice; // [핵심] '시작 가격'으로 리셋
                        stock.prevPrice = stock.initialPrice;
                        stock.history = Array(MAX_HISTORY).fill(stock.initialPrice);
                    }
                    
                    // 10분이 지나지 않았다면, 가격 업데이트를 건너뛰기 위해 return
                    return; // (forEach의 다음 아이템으로 넘어감)
                }

                // --- [B] 상장폐지 조건에 도달했는지 확인 ---
                const initialPrice = stock.initialPrice || stock.price;
                const delistThreshold = initialPrice * DELIST_PERCENT;

                // (10원 이하의 '최저가' 주식은 상폐 방지)
                if (stock.price <= delistThreshold && stock.price > 10) {
                    // 조건 도달: 상장폐지 처리
                    stock.isDelisted = true;
                    stock.delistTimestamp = now; // (클라이언트 시간 기준)
                    
                    // 상장폐지 처리 후, 가격 업데이트를 건너뛰기 위해 return
                    return; // (forEach의 다음 아이템으로 넘어감)
                }
                
                let volatility = stock.baseVolatility;
                let riseProbability = stock.baseRiseProbability - 0.005;
                
                // 1. 큰 이벤트 (폭등/폭락)
                if (Math.random() < stock.bigEventChance) {
                    volatility *= (Math.random() * 0.7 + 2.5); 
                    if (Math.random() < 0.5) {
                        riseProbability = 0.9;
                    } else {
                        riseProbability = 0.1;
                    }
                }
                
                // --- [수정] 대칭적 평균 회귀 로직 --
                
                // [A. 하락 압력] (버블 방지 - 기존 로직)
                const DYNAMIC_HIGH_THRESHOLD = initialPrice * 50; 

                if (stock.price > DYNAMIC_HIGH_THRESHOLD) {
                    const ratio = stock.price / DYNAMIC_HIGH_THRESHOLD; 
                    const downwardPressure = (ratio - 1) * REVERSION_STRENGTH_DOWN;
                    riseProbability -= downwardPressure;
                }
                
                // ▼▼▼ [신규] [B. 상승 압력] (폭락 방지) ▼▼▼
                
                // (시작 가격의 1/10 (10%) 이하로 떨어지면)
                const DYNAMIC_LOW_THRESHOLD = initialPrice / 10; 

                if (stock.price < DYNAMIC_LOW_THRESHOLD && stock.price > 10) { // (10원 미만 제외)
                    // (e.g., 가격이 임계값의 절반(0.5)이 되면)
                    const ratio = stock.price / DYNAMIC_LOW_THRESHOLD; 
                    
                    // (1.0 - 0.5) * 10% = 5%의 '상승 압력'이 추가됨
                    const upwardPressure = (1.0 - ratio) * REVERSION_STRENGTH_UP;
                    
                    riseProbability += upwardPressure;

                    // 상승 확률 상한선
                    if (riseProbability > MAX_RISE_PROBABILITY) {
                        riseProbability = MAX_RISE_PROBABILITY;
                    }
                }
                // ▲▲▲ [신규] 상승 압력 로직 끝 ▲▲▲

                // [C. 최종 확률 제한] (하한선)
                if (riseProbability < MIN_RISE_PROBABILITY) {
                    riseProbability = MIN_RISE_PROBABILITY;
                }
                // --- 평균 회귀 로직 끝 ---
                
                
                // 2. 가격 변동 계산
                const changePercent = (Math.random() * volatility) - (volatility / 2);
                let newPrice = stock.price * (1 + changePercent);
                
                // 3. 상승/하락 확률 적용 (평균 회귀가 적용된 확률)
                if (Math.random() < riseProbability) {
                    newPrice = stock.price * (1 + Math.abs(changePercent));
                } else {
                    newPrice = stock.price * (1 - Math.abs(changePercent));
                }

                // 4. 가격 하한선 (10원)
                if (newPrice < 10) newPrice = 10;
                
                // 5. 데이터 업데이트
                stock.prevPrice = stock.price;
                stock.price = Math.round(newPrice);
                
                if (!Array.isArray(stock.history)) {
                    stock.history = Array(MAX_HISTORY).fill(stock.price);
                }
                stock.history.push(stock.price);
                while (stock.history.length > MAX_HISTORY) {
                    stock.history.shift();
                }
            });
            
            return currentMarketData; 
            
        }, (error, committed, snapshot) => {
            if (error) {
                console.error("주가 업데이트 트랜잭션 실패:", error);
            }
        });
    }

    function startMarketTimer() {
        // [중요] 이미 타이머가 실행 중이면(null이 아니면) 중복 실행 방지
        if (marketUpdateTimer) {
            console.warn("관리자 타이머가 이미 이 브라우저에서 실행 중입니다.");
            return;
        }
        
        // [권장] 1.5초(1500)는 DB 요금에 매우 위험합니다. 5분(300000)을 강력히 권장합니다.
        const UPDATE_INTERVAL_MS = 1500; // 5분 (300,000 밀리초)
        
        console.log(`관리자: 주식 시장 타이머 시작 (주기: ${UPDATE_INTERVAL_MS / 1000}초)`);
        
        // 타이머를 글로벌 변수에 할당
        marketUpdateTimer = setInterval(updateStockPrices, UPDATE_INTERVAL_MS);
        
        // (선택) 관리자가 접속하자마자 1회 즉시 실행
        // updateStockPrices(); 
    }
    // ▲▲▲ [신규 1/2] 끝 ▲▲▲


    // ▼▼▼ [신규 2/2] 타이머 정지 함수 ▼▼▼
    
    /**
     * [신규] 주식 시장 타이머를 정지합니다. (로그아웃 시)
     */
    function stopMarketTimer() {
        if (marketUpdateTimer) {
            console.log("관리자: 주식 시장 타이머 정지.");
            clearInterval(marketUpdateTimer);
            marketUpdateTimer = null;
        }
    }


    // === 17. 게임 시작 ===
    initGame();
});