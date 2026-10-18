/**
 * 현장 안전관리 시스템 공통 데이터 및 유틸리티 모듈 (common.js)
 * - LocalStorage + 로컬 서버 실시간 동기화
 * - Wi-Fi IP 자동 감지 및 스마트폰용 QR 코드 생성
 * - 터치/마우스 캔버스 전자서명 패드 엔진
 */

const GITHUB_PAGES_BASE = 'https://rlagusover.github.io/-/';
const DEFAULT_LOCAL_IP = '192.168.0.3';
const DEFAULT_PORT = 8080;


const STORAGE_KEYS = {
  TBM: 'safety_tbm_records_v1',
  RISK: 'safety_risk_records_v1',
  CONFIG_IP: 'safety_custom_ip_v1'
};

/* ==========================================================================
   1. 데이터 저장소 관리자 (LocalStorage + HTTP 서버 실시간 동기화)
   ========================================================================== */
const SafetyDB = {
  // TBM 일지 목록 조회
  getTbmList() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TBM);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('TBM 데이터 로드 실패:', e);
      return [];
    }
  },

  // TBM 일지 단건 조회
  getTbmById(id) {
    const list = this.getTbmList();
    return list.find(item => item.id === id);
  },

  // TBM 일지 저장 (신규 또는 수정)
  saveTbm(tbmData) {
    const list = this.getTbmList();
    if (!tbmData.id) {
      tbmData.id = 'TBM-' + Date.now();
      tbmData.createdAt = new Date().toISOString();
      list.unshift(tbmData);
    } else {
      const idx = list.findIndex(item => item.id === tbmData.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...tbmData, updatedAt: new Date().toISOString() };
      } else {
        list.unshift(tbmData);
      }
    }
    localStorage.setItem(STORAGE_KEYS.TBM, JSON.stringify(list));
    this.syncToServer();
    return tbmData;
  },

  // TBM 일지 삭제
  deleteTbm(id) {
    const list = this.getTbmList().filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.TBM, JSON.stringify(list));
    this.syncToServer();
  },

  // 위험성평가 목록 조회
  getRiskList() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RISK);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('위험성평가 데이터 로드 실패:', e);
      return [];
    }
  },

  // 위험성평가 단건 조회
  getRiskById(id) {
    const list = this.getRiskList();
    return list.find(item => item.id === id);
  },

  // 위험성평가 저장
  saveRisk(riskData) {
    const list = this.getRiskList();
    if (!riskData.id) {
      riskData.id = 'RISK-' + Date.now();
      riskData.createdAt = new Date().toISOString();
      list.unshift(riskData);
    } else {
      const idx = list.findIndex(item => item.id === riskData.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...riskData, updatedAt: new Date().toISOString() };
      } else {
        list.unshift(riskData);
      }
    }
    localStorage.setItem(STORAGE_KEYS.RISK, JSON.stringify(list));
    this.syncToServer();
    return riskData;
  },

  // 위험성평가 삭제
  deleteRisk(id) {
    const list = this.getRiskList().filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.RISK, JSON.stringify(list));
    this.syncToServer();
  },

  // 전체 데이터 초기화
  clearAll() {
    localStorage.removeItem(STORAGE_KEYS.TBM);
    localStorage.removeItem(STORAGE_KEYS.RISK);
    this.syncToServer();
  },

  // 로컬 웹 서버와 양방향 동기화
  async syncToServer() {
    if (!window.location.protocol.startsWith('http')) return;
    if (window.location.hostname.includes('github.io')) return; // GitHub Pages는 정적 호스팅이므로 로컬스토리지 우선
    try {
      const payload = JSON.stringify({
        tbm: this.getTbmList(),
        risk: this.getRiskList(),
        syncedAt: new Date().toISOString()
      });
      await fetch('/api/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
    } catch (e) {
      // 서버 미응답 시 로컬 저장소 우선 사용
    }
  },

  // 서버로부터 최신 데이터 불러오기
  async pullFromServer() {
    if (!window.location.protocol.startsWith('http')) return false;
    if (window.location.hostname.includes('github.io')) return false; // GitHub Pages는 정적 호스팅이므로 로컬스토리지 우선
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const data = await res.json();
        if (data && (data.tbm || data.risk)) {
          if (data.tbm && data.tbm.length > 0) {
            localStorage.setItem(STORAGE_KEYS.TBM, JSON.stringify(data.tbm));
          }
          if (data.risk && data.risk.length > 0) {
            localStorage.setItem(STORAGE_KEYS.RISK, JSON.stringify(data.risk));
          }
          return true;
        }
      }
    } catch (e) {
      // fetch 실패 시 무시
    }
    return false;
  },

  // 샘플 데이터 생성
  seedSampleData() {
    const createDummySignSvg = (name) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="45" viewBox="0 0 120 45">
        <path d="M15,30 Q35,5 60,25 T105,15" fill="none" stroke="#1e3a8a" stroke-width="2.5" stroke-linecap="round"/>
        <text x="35" y="38" font-size="11" fill="#475569" font-family="sans-serif">${name} (인)</text>
      </svg>`;
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    };

    const sampleTbm = [
      {
        id: 'TBM-SAMPLE-01',
        siteName: 'lg유플러스 유선통신공사(관로/선로)- 제주권',
        workType: '접속작업, 차량유도',
        date: '2026-10-11',
        time: '08:00 ~ 08:20',
        location: '제주 관로 및 선로 작업구간',
        leaderName: '홍길동 (작업책임자)',
        workerCount: 4,
        checklistItems: [
          { no: 1, question: '작업 조건과 작업 범위에 대해 검토했는가?', result: '여' },
          { no: 2, question: '해당 NW_작업안전가이드를 검토했는가?', result: '여' },
          { no: 3, question: '공구 사용법에 대해 논의 했는가?', result: '여' },
          { no: 4, question: '사용되는 장비 및 공구의 이상 유무를 확인했는가?', result: '여' },
          { no: 5, question: '작업전 보호구 및 안전장비의 이상 유무를 확인했는가?', result: '여' },
          { no: 6, question: '유해·위험요인에 대해 조치를 실시하였는가?', result: '여' },
          { no: 7, question: '작업계획서를 작성하고 내용을 검토했는가?', result: '여' },
          { no: 8, question: '안전장구류 착용상태는 양호한가?', result: '여' },
          { no: 9, question: '작업자의 건강상태는 양호한가?', result: '여' },
          { no: 10, question: '위험성평가 내용을 전파하였는가?', result: '여' },
          { no: 11, question: '잠재위험 및 안전대책에 대해 전파하였는가?', result: '여' },
          { no: 12, question: '근로자의 작업중지권에 대해 설명했는가?', result: '여' },
          { no: 13, question: '작업구역 내 정리·정돈 상태는 양호한가?', result: '여' },
          { no: 14, question: '비상연락망 및 비상시 응급조치 절차를 숙지하였는가?', result: '여' }
        ],
        specialInstructions: '관로 작업 전 산소 및 유해가스 농도 측정 철저, 도로변 작업 시 신호수 배치 및 안전삼각대·칼라콘 설치 철저.',
        workers: [
          { name: '김철수', role: '접속공', health: '양호', sign: createDummySignSvg('김철수') },
          { name: '이영희', role: '접속공', health: '양호', sign: createDummySignSvg('이영희') },
          { name: '박민우', role: '차량유도원', health: '양호', sign: createDummySignSvg('박민우') },
          { name: '홍길동', role: '작업책임자', health: '양호', sign: createDummySignSvg('홍길동') }
        ],
        approvals: { creator: '홍길동', safetyManager: '강태우', supervisor: '김진호', siteManager: '윤정환' },
        createdAt: '2026-10-11T08:00:00.000Z'
      },
      {
        id: 'TBM-SAMPLE-02',
        siteName: '평택 바이오 반도체 클린룸 증설공사',
        workType: '배관 및 공조 덕트 고소 설치 작업',
        date: '2026-10-04',
        time: '07:30 ~ 07:50',
        location: '생산라인 FAB 2층 서측 덕트 구간',
        leaderName: '정우성 (배관팀장)',
        workerCount: 4,
        weather: '실내 / 21℃',
        healthCheck: { fit: true, alcoholTested: true, bpChecked: true, note: '특이사항 없음' },
        ppeCheck: { helmet: true, safetyShoes: true, safetyHarness: true, safetyGlasses: true, dustMask: true },
        hazards: [
          { item: '고소작업대(시저스리프트) 상승 중 협착 위험', measure: '상부 장애물(H빔) 이격거리 50cm 확보 및 과상승방지봉 점검' },
          { item: '배관 용접 시 화재 및 불티 비산', measure: '화재감시자 배치, 불티방지포 및 ABC 소화기 2대 현장 비치' }
        ],
        specialInstructions: '화기작업허가서 승인 확인 후 작업 착수, 시저스리프트 이동 시 난간대 밖으로 몸을 내밀지 말 것.',
        workers: [
          { name: '정우성', role: '배관공', health: '양호', sign: createDummySignSvg('정우성') },
          { name: '김진태', role: '용접공', health: '양호', sign: createDummySignSvg('김진태') },
          { name: '한상우', role: '화재감시원', health: '양호', sign: createDummySignSvg('한상우') },
          { name: '오세훈', role: '조공', health: '양호', sign: createDummySignSvg('오세훈') }
        ],
        approvals: { creator: '정우성', safetyManager: '오승환', supervisor: '유재석', siteManager: '송강호' },
        createdAt: '2026-10-04T07:55:00.000Z'
      }
    ];

    const sampleRisk = [
      {
        id: 'RISK-SAMPLE-01',
        siteName: '판교 제2테크노밸리 복합업무시설 신축공사',
        processName: '골조공사',
        workName: '5층 슬래브 거푸집 및 철근 배근 작업',
        evalDate: '2026-10-04',
        evaluator: '김현철 (관리감독자)',
        supervisor: '박상현 (안전관리자)',
        items: [
          {
            step: '자재 양중 및 하역',
            hazard: '타워크레인 인양 중 와이어로프 체결 불량으로 철근 다발 낙하',
            currentLevel: '상',
            measure: '2줄 걸이 샤클 체결 및 수평 확인, 양중 하부 출입통제 구역 펜스 및 신호수 1명 상주',
            afterLevel: '하',
            manager: '정성훈(신호수)',
            status: '완료'
          },
          {
            step: '슬래브 단부 거푸집 조립',
            hazard: '외측 단부 안전난간 미설치 상태에서 작업 중 18m 아래로 추락',
            currentLevel: '상',
            measure: '수평 구명줄 선행 설치 후 안전대 2중 걸이 체결, 수직보호망 조기 시공',
            afterLevel: '하',
            manager: '박준성(목공팀장)',
            status: '완료'
          },
          {
            step: '철근 가공 및 배근',
            hazard: '돌출 철근에 신체 찔림 및 전도 시 찰과상',
            currentLevel: '중',
            measure: '철근 단부 보호캡 100% 장착 및 통로 확보, 보안경 및 방진마스크 착용',
            afterLevel: '하',
            manager: '이민호(철근반장)',
            status: '완료'
          }
        ],
        approvals: { evaluator: '김현철', safetyManager: '박상현', siteManager: '윤정환' },
        createdAt: '2026-10-04T06:30:00.000Z'
      }
    ];

    localStorage.setItem(STORAGE_KEYS.TBM, JSON.stringify(sampleTbm));
    localStorage.setItem(STORAGE_KEYS.RISK, JSON.stringify(sampleRisk));
    this.syncToServer();
  }
};

/* ==========================================================================
   2. 캔버스 전자 서명 패드 엔진 (Touch & Mouse 완벽 대응)
   ========================================================================== */
class SignaturePad {
  constructor(canvasElement, placeholderElement) {
    this.canvas = canvasElement;
    this.placeholder = placeholderElement;
    this.ctx = canvasElement.getContext('2d');
    this.isDrawing = false;
    this.hasDrawn = false;
    this.init();
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      this.hasDrawn = true;
      if (this.placeholder) this.placeholder.style.display = 'none';
      const pos = getPos(e);
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
    };

    const stopDraw = (e) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      this.ctx.closePath();
    };

    this.canvas.addEventListener('mousedown', startDraw);
    this.canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDraw);

    this.canvas.addEventListener('touchstart', startDraw, { passive: false });
    this.canvas.addEventListener('touchmove', draw, { passive: false });
    this.canvas.addEventListener('touchend', stopDraw);
    this.canvas.addEventListener('touchcancel', stopDraw);
  }

  resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    
    const prevImage = this.hasDrawn ? this.canvas.toDataURL() : null;

    this.canvas.width = rect.width * ratio;
    this.canvas.height = (rect.height || 140) * ratio;
    this.ctx.scale(ratio, ratio);

    this.ctx.strokeStyle = '#0f172a';
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (prevImage) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, rect.width, rect.height || 140);
      };
      img.src = prevImage;
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hasDrawn = false;
    if (this.placeholder) this.placeholder.style.display = 'block';
  }

  isEmpty() {
    return !this.hasDrawn;
  }

  toDataURL() {
    if (this.isEmpty()) return null;
    return this.canvas.toDataURL('image/png');
  }
}

/* ==========================================================================
   3. 경량 QR 코드 렌더러
   ========================================================================== */
function renderSimpleQRCode(targetElement, text, size = 180) {
  targetElement.innerHTML = `
    <div style="display:inline-block; padding:12px; background:white; border:2px solid #0f172a; border-radius:8px; text-align:center; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}" 
           alt="QR Code" width="${size}" height="${size}" 
           onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'width:${size}px;height:${size}px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8fafc;font-size:11px;padding:8px;word-break:break-all;\\'><span style=\\'font-weight:bold;margin-bottom:4px;\\'>[오프라인 접속 주소]</span>${text}</div>';"
           style="display:block; margin:0 auto;" />
      <div style="margin-top:8px; font-size:11.5px; font-weight:700; color:#1e293b;">스마트폰 카메라로 스캔하세요</div>
    </div>
  `;
}

/* ==========================================================================
   4. 알림 토스트
   ========================================================================== */
function showToast(message) {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

// Firebase Firestore 공유 저장소 (GitHub Pages용)
window.SafetyDB = SafetyDB;
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDyNGBt58RUL4moCwjLaXfcu_GzC31_QRU",
  authDomain: "safety-management-4b7f9.firebaseapp.com",
  projectId: "safety-management-4b7f9",
  storageBucket: "safety-management-4b7f9.firebasestorage.app",
  messagingSenderId: "645604750807",
  appId: "1:645604750807:web:2a4f662b24b53290a7c792"
};
let firebaseDb = null;
let firebaseReady = (async function () {
  try {
    if (!window.firebase) throw new Error('Firebase SDK를 불러오지 못했습니다.');
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    firebaseDb = firebase.firestore();
    // Firestore 규칙의 request.auth != null 조건을 충족하도록 익명 로그인
    if (!firebase.auth().currentUser) {
      await firebase.auth().signInAnonymously();
    }
    return !!firebase.auth().currentUser;
  } catch (err) {
    console.error('Firebase 인증/초기화 실패:', err);
    if (typeof showToast === 'function') showToast('Firebase 인증 실패: Authentication 익명 로그인을 확인하세요.');
    return false;
  }
})();

const _originalDeleteTbm = SafetyDB.deleteTbm.bind(SafetyDB);
const _originalDeleteRisk = SafetyDB.deleteRisk.bind(SafetyDB);
const _originalClearAll = SafetyDB.clearAll.bind(SafetyDB);
SafetyDB.syncToServer = async function() {
  const ready = await firebaseReady;
  if (!ready || !firebaseDb) return false;
  try {
    const groups = [
      ['tbmRecords', this.getTbmList()],
      ['riskRecords', this.getRiskList()]
    ];
    for (const [collectionName, records] of groups) {
      for (const record of records) {
        if (record && record.id) {
          await firebaseDb.collection(collectionName).doc(String(record.id)).set(record);
        }
      }
    }
    return true;
  } catch (err) {
    console.error('Firebase 저장 실패:', err);
    if (typeof showToast === 'function') showToast('공용 저장 실패: Firebase 보안 규칙을 확인하세요.');
    return false;
  }
};
SafetyDB.deleteTbm = function(id) {
  _originalDeleteTbm(id);
  firebaseReady.then(ready => ready && firebaseDb && firebaseDb.collection('tbmRecords').doc(String(id)).delete().catch(console.error));
};
SafetyDB.deleteRisk = function(id) {
  _originalDeleteRisk(id);
  firebaseReady.then(ready => ready && firebaseDb && firebaseDb.collection('riskRecords').doc(String(id)).delete().catch(console.error));
};
SafetyDB.clearAll = function() {
  _originalClearAll();
  firebaseReady.then(async ready => {
    if (!ready || !firebaseDb) return;
    for (const name of ['tbmRecords','riskRecords']) {
      const snap = await firebaseDb.collection(name).get();
      for (const doc of snap.docs) await doc.ref.delete();
    }
  }).catch(console.error);
};
SafetyDB.pullFromServer = async function() {
  const ready = await firebaseReady;
  if (!ready || !firebaseDb) return false;
  try {
    const [tbmSnap, riskSnap] = await Promise.all([
      firebaseDb.collection('tbmRecords').get(),
      firebaseDb.collection('riskRecords').get()
    ]);
    const tbm = tbmSnap.docs.map(d => d.data()).sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    const risk = riskSnap.docs.map(d => d.data()).sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    if (tbm.length || risk.length) {
      localStorage.setItem(STORAGE_KEYS.TBM, JSON.stringify(tbm));
      localStorage.setItem(STORAGE_KEYS.RISK, JSON.stringify(risk));
      return true;
    }
    return false;
  } catch (err) {
    console.error('Firebase 불러오기 실패:', err);
    if (typeof showToast === 'function') showToast('공용 조회 실패: Firebase 보안 규칙을 확인하세요.');
    return false;
  }
};

// 초기화: 클라우드 데이터가 있으면 우선 사용하고, 최초 1회만 로컬/샘플 데이터를 업로드합니다.
(async function initializeSafetyApp() {
  const cloudHasData = await SafetyDB.pullFromServer();
  if (cloudHasData) return;
  const hasLocal = !!(localStorage.getItem(STORAGE_KEYS.TBM) || localStorage.getItem(STORAGE_KEYS.RISK));
  if (hasLocal) {
    await SafetyDB.syncToServer();
  } else {
    SafetyDB.seedSampleData();
  }
})();
