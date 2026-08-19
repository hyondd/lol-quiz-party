const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: false } });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));

const rooms = new Map();
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 40;
const MAX_QUESTIONS = 100;

const DEFAULT_QUESTIONS = [
  { text: '【名言】「この光の力を使えるのは私だけ、だからどこで輝かせるかは気を付けてるの」――この言葉の主は？', ko: '【명대사】「이 빛의 힘을 쓸 수 있는 건 나뿐이니까, 어디서 빛낼지는 조심해야 해」라는 말의 주인공은?', options: ['ラックス', 'ソナ', 'セラフィーン', 'ケイル'], optionsKo: ['럭스', '소나', '세라핀', '케일'], answer: 0 },
  { text: '【名言】「死は風のようなもの」で始まる有名な台詞で知られるチャンピオンは？', ko: '【명대사】「죽음은 바람과 같다」로 시작하는 유명한 대사로 알려진 챔피언은?', options: ['ヤスオ', 'ヨネ', 'ゼド', 'シェン'], optionsKo: ['야스오', '요네', '제드', '쉔'], answer: 0 },
  { text: '【小ネタ】「OK.」の一言であまりにも有名なチャンピオンは？', ko: '【소소한 이야기】「OK.」 한마디로 너무 유명한 챔피언은?', options: ['ラムス', 'マルファイト', 'ブリッツクランク', 'ムンド'], optionsKo: ['람머스', '말파이트', '블리츠크랭크', '문도 박사'], answer: 0 },
  { text: '【小ネタ】英語版の有名な台詞「Welcome to the League of Draven.」を言うのは？', ko: '【소소한 이야기】영어판 유명 대사 「Welcome to the League of Draven.」을 말하는 챔피언은?', options: ['ドレイヴン', 'ダリウス', 'セト', 'パンテオン'], optionsKo: ['드레이븐', '다리우스', '세트', '판테온'], answer: 0 },
  { text: '【小ネタ】数字の「4」への異常なこだわりで知られるチャンピオンは？', ko: '【소소한 이야기】숫자 4에 집착하는 것으로 유명한 챔피언은?', options: ['ジン', 'アフェリオス', 'グレイブス', 'スモルダー'], optionsKo: ['진', '아펠리오스', '그레이브즈', '스몰더'], answer: 0 },

  { text: '【プロ】2024年、Hall of Legends最初の殿堂入り選手になったのは？', ko: '【프로】2024년 Hall of Legends의 첫 헌액자가 된 선수는?', options: ['Faker', 'Uzi', 'Deft', 'Mata'], optionsKo: ['페이커', '우지', '데프트', '마타'], answer: 0 },
  { text: '【プロ】2025年、Hall of Legendsの2人目の殿堂入り選手は？', ko: '【프로】2025년 Hall of Legends의 두 번째 헌액자는?', options: ['Uzi', 'Deft', 'Caps', 'Rookie'], optionsKo: ['우지', '데프트', '캡스', '루키'], answer: 0 },
  { text: '【プロ】Fakerの有名な異名としてRiot公式Hall of Legendsでも紹介されるのは？', ko: '【프로】라이엇 공식 Hall of Legends에서도 소개되는 Faker의 유명한 별명은?', options: ['Demon King', 'Mad Dog', 'The General', 'The Professor'], optionsKo: ['마왕', '광견', '장군', '교수'], answer: 0 },
  { text: '【プロ】Uziの超攻撃的なプレイスタイルから付いた有名な異名は？', ko: '【프로】Uzi의 매우 공격적인 플레이 스타일에서 나온 유명한 별명은?', options: ['Mad Dog', 'Demon King', 'Unkillable', 'TheShy'], optionsKo: ['광견', '마왕', '불사대마왕', '더샤이'], answer: 0 },
  { text: '【プロ】2023・2024・2025 Worldsを3年連続で制し、史上初の3連覇を達成したチームは？', ko: '【프로】2023·2024·2025 월즈를 3년 연속 우승해 역사상 최초 3연패를 달성한 팀은?', options: ['T1', 'Gen.G', 'BLG', 'DRX'], optionsKo: ['T1', '젠지', 'BLG', 'DRX'], answer: 0 },
  { text: '【プロ】T1の2025 Worlds MVPスキンに選ばれたチャンピオンは？', ko: '【프로】T1의 2025 월즈 MVP 스킨으로 선정된 챔피언은?', options: ['ミス・フォーチュン', 'ガリオ', 'ユナラ', 'セラフィーン'], optionsKo: ['미스 포츈', '갈리오', '유나라', '세라핀'], answer: 0 },
  { text: '【プロ】Uziが歴史的に最も有名になったロールは？', ko: '【프로】Uzi가 역사적으로 가장 유명해진 포지션은?', options: ['ボット／マークスマン', 'トップ', 'ジャングル', 'サポート'], optionsKo: ['바텀/원거리 딜러', '탑', '정글', '서포터'], answer: 0 },

  { text: '【ストーリー】魔法を危険視するデマーシアで、自分が魔法使いであることを長く隠していたのは？', ko: '【스토리】마법을 위험하게 보는 데마시아에서 자신이 마법사라는 사실을 오래 숨겨 온 인물은?', options: ['ラックス', 'カタリナ', 'レオナ', 'シヴィア'], optionsKo: ['럭스', '카타리나', '레오나', '시비르'], answer: 0 },
  { text: '【ストーリー】ラックスの本名は？', ko: '【스토리】럭스의 본명은?', options: ['ラクサーナ・クラウンガード', 'カタリナ・デュ・クートー', 'サラ・フォーチュン', 'シェリア・ヴァーン'], optionsKo: ['럭산나 크라운가드', '카타리나 뒤 쿠토', '사라 포츈', '셰리아 반'], answer: 0 },
  { text: '【ストーリー】自分に残っていた人間の心臓を父親へ移植し、完全な機械の身体になったチャンピオンは？', ko: '【스토리】자신에게 남아 있던 인간의 심장을 아버지에게 이식하고 완전한 기계 몸이 된 챔피언은?', options: ['オリアナ', 'カミール', 'ビクター', 'ブリッツクランク'], optionsKo: ['오리아나', '카밀', '빅토르', '블리츠크랭크'], answer: 0 },
  { text: '【ストーリー】オリアナの父親の名前は？', ko: '【스토리】오리아나의 아버지 이름은?', options: ['コリン・レヴェック', 'シンジド', 'ハイマーディンガー', 'ジェイス・タリス'], optionsKo: ['코린 레벡', '신지드', '하이머딩거', '제이스 탈리스'], answer: 0 },
  { text: '【ストーリー】ヤスオが若い頃、無実なのに疑われた罪は？', ko: '【스토리】젊은 시절 야스오가 억울하게 의심받은 죄는?', options: ['師匠を殺したこと', 'ノクサスへ亡命したこと', '禁術を盗んだこと', '皇帝を襲ったこと'], optionsKo: ['스승을 죽였다는 죄', '녹서스로 망명한 죄', '금지된 기술을 훔친 죄', '황제를 공격한 죄'], answer: 0 },
  { text: '【ストーリー】ヤスオの兄で、一度死んだ後に戻ってきたチャンピオンは？', ko: '【스토리】야스오의 형이며 한 번 죽은 뒤 돌아온 챔피언은?', options: ['ヨネ', 'ゼド', 'シェン', 'マスター・イー'], optionsKo: ['요네', '제드', '쉔', '마스터 이'], answer: 0 },
  { text: '【ストーリー】ヤスオの師匠の死を巡る物語で、「折れた剣」が重要な証拠になったチャンピオンは？', ko: '【스토리】야스오의 스승 죽음을 둘러싼 이야기에서 부러진 검이 중요한 증거가 된 챔피언은?', options: ['リヴェン', 'イレリア', 'アカリ', 'カリスタ'], optionsKo: ['리븐', '이렐리아', '아칼리', '칼리스타'], answer: 0 },
  { text: '【ストーリー】アフェリオスへ霊界から武器を送り届ける双子の妹は？', ko: '【스토리】아펠리오스에게 영혼 세계에서 무기를 보내 주는 쌍둥이 여동생은?', options: ['アルーン', 'ダイアナ', 'レオナ', 'ソラカ'], optionsKo: ['알룬', '다이애나', '레오나', '소라카'], answer: 0 },
  { text: '【ストーリー】アフェリオスとアルーンが属する信仰は？', ko: '【스토리】아펠리오스와 알룬이 속한 신앙은?', options: ['ルナリ', 'ソラリ', 'センチネル', 'キンコウ'], optionsKo: ['루나리', '솔라리', '감시단', '킨코우'], answer: 0 },
  { text: '【ストーリー】かつてスレッシュのランタンに魂を囚われていたマークスマンは？', ko: '【스토리】한때 쓰레쉬의 랜턴 안에 영혼이 갇혀 있던 원거리 딜러는?', options: ['セナ', 'ルシアン', 'カリスタ', 'ヴェイン'], optionsKo: ['세나', '루시안', '칼리스타', '베인'], answer: 0 },
  { text: '【ストーリー】ヴィエゴが愛し、破滅へ向かうきっかけとなった王妃の名は？', ko: '【스토리】비에고가 사랑했고 파멸로 향하는 계기가 된 왕비의 이름은?', options: ['イゾルデ', 'カリスタ', 'グウェン', 'セナ'], optionsKo: ['이졸데', '칼리스타', '그웬', '세나'], answer: 0 },
  { text: '【ストーリー】復讐を求める魂たちの象徴「復讐の槍」として知られるチャンピオンは？', ko: '【스토리】복수를 원하는 영혼들의 상징인 복수의 창으로 알려진 챔피언은?', options: ['カリスタ', 'ヘカリム', 'ヨリック', 'カーサス'], optionsKo: ['칼리스타', '헤카림', '요릭', '카서스'], answer: 0 },

  { text: '【特殊仕様】敵のアルティメットを奪って自分で使えるのは？', ko: '【특수 판정】적의 궁극기를 훔쳐 직접 사용할 수 있는 챔피언은?', options: ['サイラス', 'ヴィエゴ', 'ニーコ', 'ルブラン'], optionsKo: ['사일러스', '비에고', '니코', '르블랑'], answer: 0 },
  { text: '【特殊仕様】ヴィエゴが敵を憑依したとき、基本的にコピーしないものは？', ko: '【특수 판정】비에고가 적에게 빙의했을 때 기본적으로 복사하지 않는 것은?', options: ['その敵のアルティメット', '通常スキル', '通常攻撃特性', 'アイテム'], optionsKo: ['그 적의 궁극기', '일반 스킬', '기본 공격 특성', '아이템'], answer: 0 },
  { text: '【特殊仕様】アフェリオスに通常のアクティブスキルが存在しないキーは？', ko: '【특수 판정】아펠리오스에게 일반적인 액티브 스킬이 없는 키는?', options: ['E', 'Q', 'W', 'R'], optionsKo: ['E', 'Q', 'W', 'R'], answer: 0 },
  { text: '【特殊仕様】フェイはQ・W・Eの主題からさらにQ・W・Eを選ぶ。基本スキルの組み合わせは？', ko: '【특수 판정】흐웨이는 Q·W·E 주제에서 다시 Q·W·E를 고른다. 기본 스킬 조합 수는?', options: ['9通り', '6通り', '8通り', '12通り'], optionsKo: ['9가지', '6가지', '8가지', '12가지'], answer: 0 },
  { text: '【特殊仕様】ポッピーWで止められない移動は？', ko: '【특수 판정】뽀삐 W로 막을 수 없는 이동은?', options: ['エズリアルE', 'トリスターナW', 'ルシアンE', 'リヴェンE'], optionsKo: ['이즈리얼 E', '트리스타나 W', '루시안 E', '리븐 E'], answer: 0 },
  { text: '【特殊仕様】ヤスオW「風殺の壁」を通過できる代表例は？', ko: '【특수 판정】야스오 W 바람 장막을 통과할 수 있는 대표적인 스킬은?', options: ['セナQ', 'エズリアルQ', 'アーリE', 'ナミR'], optionsKo: ['세나 Q', '이즈리얼 Q', '아리 E', '나미 R'], answer: 0 },
  { text: '【特殊仕様】ガングプランクW「壊血病治癒」で解除できる代表的な強CCは？', ko: '【특수 판정】갱플랭크 W 괴혈병 치료로 해제할 수 있는 대표적인 강한 CC는?', options: ['サプレッション', 'ノックアップだけ', '地形生成', 'ステイシス'], optionsKo: ['제압', '에어본만', '지형 생성', '경직'], answer: 0 },
  { text: '【特殊仕様】サモナースペル「クレンズ」で解除できないのは？', ko: '【특수 판정】소환사 주문 정화로 해제할 수 없는 것은?', options: ['サプレッション', 'スタン', 'チャーム', '恐怖'], optionsKo: ['제압', '기절', '매혹', '공포'], answer: 0 },
  { text: '【特殊仕様】行動妨害耐性（Tenacity）で基本的に短縮できないCCは？', ko: '【특수 판정】강인함으로 기본적으로 지속시간을 줄일 수 없는 CC는?', options: ['ノックアップ', 'スタン', '挑発', '恐怖'], optionsKo: ['에어본', '기절', '도발', '공포'], answer: 0 },
  { text: '【特殊仕様】バードRでステイシス状態にできる意外な対象は？', ko: '【특수 판정】바드 R로 경직 상태로 만들 수 있는 의외의 대상은?', options: ['タワー', 'ネクサス本体', 'ショップ', '泉のレーザー'], optionsKo: ['포탑', '넥서스 본체', '상점', '우물 레이저'], answer: 0 },
  { text: '【特殊仕様】キンドレッドRの範囲内で死亡を防がれるのは？', ko: '【특수 판정】킨드레드 R 범위 안에서 죽음을 방지받는 대상은?', options: ['敵味方の両方', '味方だけ', '敵だけ', 'キンドレッドだけ'], optionsKo: ['적과 아군 모두', '아군만', '적만', '킨드레드만'], answer: 0 },
  { text: '【特殊仕様】グウェンWの外側にいる敵について正しいのは？', ko: '【특수 판정】그웬 W 바깥에 있는 적에 대한 설명으로 맞는 것은?', options: ['基本的にグウェンを対象指定できず、攻撃も当てにくい', '必ずスタンする', '移動速度が0になる', '視界だけ失う'], optionsKo: ['기본적으로 그웬을 지정할 수 없고 공격도 맞히기 어렵다', '무조건 기절한다', '이동 속도가 0이 된다', '시야만 잃는다'], answer: 0 },

  { text: '【チャンピオン】通常攻撃の弾倉が4発で、4発目が特別な一撃になるのは？', ko: '【챔피언】기본 공격 탄창이 4발이며 4번째 탄이 특별한 공격이 되는 챔피언은?', options: ['ジン', 'グレイブス', 'ケイトリン', 'サミーラ'], optionsKo: ['진', '그레이브즈', '케이틀린', '사미라'], answer: 0 },
  { text: '【チャンピオン】「脳震盪パンチ」を4スタックまで重ねるとスタンさせるのは？', ko: '【챔피언】뇌진탕 펀치를 4스택 쌓으면 기절시키는 챔피언은?', options: ['ブラウム', 'レオナ', 'ノーチラス', 'タリック'], optionsKo: ['브라움', '레오나', '노틸러스', '타릭'], answer: 0 },
  { text: '【チャンピオン】「嵐の刻印」を3つ付けると敵をスタンさせるのは？', ko: '【챔피언】폭풍의 표식을 3개 붙이면 적을 기절시키는 챔피언은?', options: ['ケネン', 'ゼリ', 'ボリベア', 'ジェイス'], optionsKo: ['케넨', '제리', '볼리베어', '제이스'], answer: 0 },
  { text: '【チャンピオン】同じ敵へ3回攻撃するとシルバーボルトが発動するのは？', ko: '【챔피언】같은 적을 3번 공격하면 은화살이 발동하는 챔피언은?', options: ['ヴェイン', 'カイ＝サ', 'コグ＝マウ', 'トリスターナ'], optionsKo: ['베인', '카이사', '코그모', '트리스타나'], answer: 0 },
  { text: '【チャンピオン】チャイムを集めるほどミィプが強化されるのは？', ko: '【챔피언】차임을 모을수록 미프가 강화되는 챔피언은?', options: ['バード', 'ミリオ', 'ソナ', 'タリック'], optionsKo: ['바드', '밀리오', '소나', '타릭'], answer: 0 },
  { text: '【チャンピオン】霧の亡霊を集め、攻撃力や射程などを伸ばすのは？', ko: '【챔피언】안개 망령을 모아 공격력과 사거리 등을 늘리는 챔피언은?', options: ['セナ', 'スレッシュ', 'キンドレッド', 'ヴェイガー'], optionsKo: ['세나', '쓰레쉬', '킨드레드', '베이가'], answer: 0 },
  { text: '【チャンピオン】魂を集め、主に防御力と魔力を伸ばすサポートは？', ko: '【챔피언】영혼을 모아 주로 방어력과 주문력을 올리는 서포터는?', options: ['スレッシュ', 'セナ', 'スウェイン', 'カーサス'], optionsKo: ['쓰레쉬', '세나', '스웨인', '카서스'], answer: 0 },
  { text: '【チャンピオン】Qで敵を倒すほど、そのQが永久に強くなる代表的チャンピオンは？', ko: '【챔피언】Q로 적을 처치할수록 그 Q가 영구적으로 강해지는 대표적인 챔피언은?', options: ['ナサス', 'ヨリック', 'レネクトン', 'トランドル'], optionsKo: ['나서스', '요릭', '레넥톤', '트런들'], answer: 0 },
  { text: '【チャンピオン】R「捕食」のスタックで最大体力だけでなく体の大きさも増えるのは？', ko: '【챔피언】R 포식 스택으로 최대 체력뿐 아니라 몸집도 커지는 챔피언은?', options: ['チョ＝ガス', 'タム・ケンチ', 'ザック', 'オーン'], optionsKo: ['초가스', '탐 켄치', '자크', '오른'], answer: 0 },

  { text: '【マップ】バロンバフを持つ味方チャンピオンの近くで、特に強化されるものは？', ko: '【맵】바론 버프를 가진 아군 챔피언 근처에서 특히 강화되는 것은?', options: ['味方ミニオン', '味方ワード', '味方タワー', 'ジャングル植物'], optionsKo: ['아군 미니언', '아군 와드', '아군 포탑', '정글 식물'], answer: 0 },
  { text: '【マップ】低体力の敵を強力に処刑する効果で知られる大型オブジェクトのバフは？', ko: '【맵】체력이 낮은 적을 강하게 처형하는 효과로 유명한 대형 오브젝트 버프는?', options: ['エルダードラゴン', 'バロン・ナッシャー', 'リフトヘラルド', 'リフトスカトル'], optionsKo: ['장로 드래곤', '내셔 남작', '협곡의 전령', '협곡 바위 게'], answer: 0 },
  { text: '【マップ】倒すと川にスピードの祠を作る中立モンスターは？', ko: '【맵】처치하면 강에 속도의 성소를 만드는 중립 몬스터는?', options: ['リフトスカトル', 'ヴォイドグラブ', 'ブルーセンチネル', 'ラプター'], optionsKo: ['협곡 바위 게', '공허 유충', '푸른 파수꾼', '칼날부리'], answer: 0 },
  { text: '【マップ】攻撃すると周囲のユニットを爆風で飛ばす植物は？', ko: '【맵】공격하면 주변 유닛을 폭발로 날려 보내는 식물은?', options: ['ブラストコーン', 'スクライヤーブルーム', 'ハニーフルーツ', 'フェイライト'], optionsKo: ['솔방울탄', '수정초', '꿀열매', '페이라이트'], answer: 0 },
  { text: '【マップ】攻撃した方向へ広範囲の視界を飛ばす植物は？', ko: '【맵】공격한 방향으로 넓은 시야를 보내는 식물은?', options: ['スクライヤーブルーム', 'ブラストコーン', 'ハニーフルーツ', 'レッドバフ'], optionsKo: ['수정초', '솔방울탄', '꿀열매', '레드 버프'], answer: 0 },
  { text: '【マップ】敵インヒビター破壊後、そのレーンに追加される特別なミニオンは？', ko: '【맵】적 억제기 파괴 후 그 라인에 추가되는 특별한 미니언은?', options: ['スーパーミニオン', 'エリートミニオン', 'バロンミニオン', 'ネクサスミニオン'], optionsKo: ['슈퍼 미니언', '엘리트 미니언', '바론 미니언', '넥서스 미니언'], answer: 0 },
  { text: '【マップ】敵ネクサス本体を攻撃可能にする直前に破壊する必要があるのは？', ko: '【맵】적 넥서스 본체를 공격 가능하게 만들기 직전에 파괴해야 하는 것은?', options: ['2本のネクサスタワー', '全ての外側タワー', '全てのインヒビター', 'バロン'], optionsKo: ['넥서스 포탑 2개', '모든 외곽 포탑', '모든 억제기', '바론'], answer: 0 },
  { text: '【マップ】「ヘラルドの瞳」を使うと自チーム側として召喚できるのは？', ko: '【맵】전령의 눈을 사용하면 아군 편으로 소환할 수 있는 것은?', options: ['リフトヘラルド', 'バロン・ナッシャー', 'エルダードラゴン', 'スカトル'], optionsKo: ['협곡의 전령', '내셔 남작', '장로 드래곤', '바위 게'], answer: 0 }
];

function makeCode() {
  for (let tries = 0; tries < 100; tries++) {
    let code = '';
    for (let i = 0; i < 5; i++) code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
    if (!rooms.has(code)) return code;
  }
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function safeName(name) {
  return String(name || '').trim().slice(0, 18) || 'プレイヤー';
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hasTripleStreak(slots) {
  for (let i = 2; i < slots.length; i++) {
    if (slots[i] === slots[i - 1] && slots[i] === slots[i - 2]) return true;
  }
  return false;
}

function makeBalancedAnswerSlots(count) {
  const base = [];
  for (let i = 0; i < count; i++) base.push(i % 4);
  let slots = shuffleArray(base);
  for (let tries = 0; tries < 200 && hasTripleStreak(slots); tries++) slots = shuffleArray(base);
  return slots;
}

function buildPlayQuestions(sourceQuestions) {
  const questions = shuffleArray(sourceQuestions.map(q => ({
    text: q.text,
    ko: q.ko || '',
    options: [...q.options],
    optionsKo: Array.isArray(q.optionsKo) ? [...q.optionsKo] : ['', '', '', ''],
    answer: q.answer
  })));
  const answerSlots = makeBalancedAnswerSlots(questions.length);

  return questions.map((q, index) => {
    const choices = q.options.map((text, i) => ({ text, ko: q.optionsKo[i] || '' }));
    const correctChoice = choices[q.answer];
    const wrongChoices = shuffleArray(choices.filter((_, i) => i !== q.answer));
    const target = answerSlots[index];
    const arranged = new Array(4);
    arranged[target] = correctChoice;
    let wi = 0;
    for (let i = 0; i < 4; i++) if (i !== target) arranged[i] = wrongChoices[wi++];
    return {
      text: q.text,
      ko: q.ko,
      options: arranged.map(x => x.text),
      optionsKo: arranged.map(x => x.ko),
      answer: target
    };
  });
}

function publicPlayers(room) {
  return [...room.players.values()]
    .map(p => ({ id: p.id, name: p.name, score: p.score, isHost: p.id === room.hostId }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function lobbyState(room) {
  return {
    code: room.code,
    title: room.title,
    status: room.status,
    players: publicPlayers(room),
    questionCount: room.questions.length,
    secondsPerQuestion: room.secondsPerQuestion
  };
}

function emitLobby(room) {
  io.to(room.code).emit('lobby-state', lobbyState(room));
}

function normalizeQuestions(raw) {
  if (!Array.isArray(raw)) return null;
  const cleaned = raw.slice(0, MAX_QUESTIONS).map(q => {
    const text = String(q?.text || '').trim().slice(0, 260);
    const ko = String(q?.ko || '').trim().slice(0, 260);
    const options = Array.isArray(q?.options) ? q.options.slice(0, 4).map(x => String(x || '').trim().slice(0, 120)) : [];
    const optionsKo = Array.isArray(q?.optionsKo) ? q.optionsKo.slice(0, 4).map(x => String(x || '').trim().slice(0, 120)) : ['', '', '', ''];
    while (optionsKo.length < 4) optionsKo.push('');
    const answer = Number(q?.answer);
    if (!text || options.length !== 4 || options.some(x => !x) || !Number.isInteger(answer) || answer < 0 || answer > 3) return null;
    return { text, ko, options, optionsKo, answer };
  }).filter(Boolean);
  return cleaned.length ? cleaned : null;
}

function clearRoomTimers(room) {
  if (room.answerTimer) clearTimeout(room.answerTimer);
  if (room.nextTimer) clearTimeout(room.nextTimer);
  room.answerTimer = null;
  room.nextTimer = null;
}

function sendQuestion(room) {
  clearRoomTimers(room);
  room.answered.clear();
  room.answers.clear();
  room.questionResolved = false;
  room.questionStartedAt = Date.now();
  const q = room.playQuestions[room.questionIndex];
  io.to(room.code).emit('question', {
    index: room.questionIndex,
    total: room.playQuestions.length,
    text: q.text,
    ko: q.ko,
    options: q.options,
    optionsKo: q.optionsKo,
    seconds: room.secondsPerQuestion
  });
  room.answerTimer = setTimeout(() => revealAnswer(room), room.secondsPerQuestion * 1000);
}

function revealAnswer(room) {
  if (!rooms.has(room.code) || room.status !== 'playing' || room.questionResolved) return;
  room.questionResolved = true;
  clearTimeout(room.answerTimer);
  room.answerTimer = null;
  const q = room.playQuestions[room.questionIndex];
  const wrongPlayers = [];
  const unansweredPlayers = [];

  for (const p of room.players.values()) {
    if (!room.answers.has(p.id)) {
      unansweredPlayers.push({ id: p.id, name: p.name });
      continue;
    }
    const picked = room.answers.get(p.id);
    if (picked !== q.answer) wrongPlayers.push({ id: p.id, name: p.name, answerIndex: picked });
  }

  io.to(room.code).emit('answer-reveal', {
    correctIndex: q.answer,
    players: publicPlayers(room),
    wrongPlayers,
    unansweredPlayers
  });

  room.nextTimer = setTimeout(() => {
    if (!rooms.has(room.code) || room.status !== 'playing') return;
    room.questionIndex += 1;
    if (room.questionIndex >= room.playQuestions.length) finishGame(room);
    else sendQuestion(room);
  }, 5200);
}

function finishGame(room) {
  clearRoomTimers(room);
  room.status = 'finished';
  io.to(room.code).emit('game-finished', { players: publicPlayers(room) });
  emitLobby(room);
}

io.on('connection', socket => {
  socket.on('create-room', ({ name, title }) => {
    const code = makeCode();
    const room = {
      code,
      title: String(title || 'LoL クイズパーティー').trim().slice(0, 40) || 'LoL クイズパーティー',
      hostId: socket.id,
      status: 'lobby',
      players: new Map(),
      questions: DEFAULT_QUESTIONS.map(q => ({ ...q, options: [...q.options], optionsKo: [...q.optionsKo] })),
      playQuestions: [],
      secondsPerQuestion: 15,
      questionIndex: 0,
      answered: new Set(),
      answers: new Map(),
      questionResolved: false,
      questionStartedAt: 0,
      answerTimer: null,
      nextTimer: null
    };
    room.players.set(socket.id, { id: socket.id, name: safeName(name), score: 0 });
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room-created', { code, isHost: true });
    socket.emit('quiz-data', { questions: room.questions, secondsPerQuestion: room.secondsPerQuestion, title: room.title });
    emitLobby(room);
  });

  socket.on('join-room', ({ code, name }) => {
    code = String(code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit('join-error', 'そのルームは見つかりません。ルームコードを確認してね。');
    if (room.status !== 'lobby') return socket.emit('join-error', 'このルームはすでにゲーム中です。次のゲームを待ってね！');
    if (room.players.size >= MAX_PLAYERS) return socket.emit('join-error', 'このルームは満員です。');
    room.players.set(socket.id, { id: socket.id, name: safeName(name), score: 0 });
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room-joined', { code, isHost: false });
    emitLobby(room);
  });

  socket.on('update-quiz', ({ code, title, questions, secondsPerQuestion }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    const normalized = normalizeQuestions(questions);
    if (!normalized) return socket.emit('quiz-error', '問題形式を確認してね。各問題には4つの選択肢と1つの正解が必要です。');
    room.questions = normalized;
    room.title = String(title || room.title).trim().slice(0, 40) || 'LoL クイズパーティー';
    const s = Number(secondsPerQuestion);
    room.secondsPerQuestion = Number.isFinite(s) ? Math.min(60, Math.max(5, Math.round(s))) : 15;
    socket.emit('quiz-saved');
    emitLobby(room);
  });

  socket.on('start-game', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'lobby' || room.questions.length < 1) return;
    room.status = 'playing';
    room.questionIndex = 0;
    room.playQuestions = buildPlayQuestions(room.questions);
    room.answers.clear();
    room.answered.clear();
    for (const p of room.players.values()) p.score = 0;
    emitLobby(room);
    io.to(room.code).emit('game-started');
    setTimeout(() => {
      if (rooms.has(room.code) && room.status === 'playing') sendQuestion(room);
    }, 900);
  });

  socket.on('submit-answer', ({ code, answerIndex }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.status !== 'playing' || room.questionResolved || !room.players.has(socket.id) || room.answered.has(socket.id)) return;
    const idx = Number(answerIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) return;

    room.answered.add(socket.id);
    room.answers.set(socket.id, idx);
    const q = room.playQuestions[room.questionIndex];
    const elapsed = Date.now() - room.questionStartedAt;
    const totalMs = room.secondsPerQuestion * 1000;
    if (idx === q.answer) {
      const remainingRatio = Math.max(0, 1 - elapsed / totalMs);
      const gained = Math.round(500 + 500 * remainingRatio);
      room.players.get(socket.id).score += gained;
    }

    socket.emit('answer-locked', { submitted: true });
    io.to(room.code).emit('answer-progress', { answered: room.answered.size, total: room.players.size });
    if (room.answered.size >= room.players.size) setTimeout(() => revealAnswer(room), 500);
  });

  socket.on('restart-lobby', ({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== 'finished') return;
    room.status = 'lobby';
    room.questionIndex = 0;
    room.playQuestions = [];
    room.answered.clear();
    room.answers.clear();
    room.questionResolved = false;
    for (const p of room.players.values()) p.score = 0;
    io.to(room.code).emit('back-to-lobby');
    socket.emit('quiz-data', { questions: room.questions, secondsPerQuestion: room.secondsPerQuestion, title: room.title });
    emitLobby(room);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    if (room.hostId === socket.id) {
      clearRoomTimers(room);
      io.to(code).emit('room-closed', 'ホストが退出したため、ルームが終了しました。');
      rooms.delete(code);
      return;
    }

    room.players.delete(socket.id);
    room.answered.delete(socket.id);
    room.answers.delete(socket.id);
    if (room.players.size === 0) {
      clearRoomTimers(room);
      rooms.delete(code);
    } else {
      emitLobby(room);
      if (room.status === 'playing' && !room.questionResolved && room.answered.size >= room.players.size) revealAnswer(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`LoL Quiz Party running on port ${PORT}`));
