const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: false }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));

const rooms = new Map();
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 40;
const MAX_QUESTIONS = 100;

const DEFAULT_QUESTIONS = [
  {
    text: '敵チャンピオンのアルティメットを奪って、自分で使えるチャンピオンは？',
    ko: '적 챔피언의 궁극기를 빼앗아 직접 사용할 수 있는 챔피언은?',
    options: ['サイラス', 'ヴィエゴ', 'ルブラン', 'ニーコ'],
    optionsKo: ['사일러스', '비에고', '르블랑', '니코'],
    answer: 0
  },
  {
    text: '通常攻撃の弾倉が「4発」で、最後の一発に特別な効果があるチャンピオンは？',
    ko: '기본 공격 탄창이 4발이고 마지막 한 발에 특별한 효과가 있는 챔피언은?',
    options: ['ジン', 'グレイブス', 'ケイトリン', 'サミーラ'],
    optionsKo: ['진', '그레이브즈', '케이틀린', '사미라'],
    answer: 0
  },
  {
    text: '通常攻撃がショットガン式で、弾を撃ち切るとリロードが必要になるチャンピオンは？',
    ko: '기본 공격이 산탄총 방식이며 탄을 다 쓰면 재장전해야 하는 챔피언은?',
    options: ['グレイブス', 'ルシアン', 'アフェリオス', 'コーキ'],
    optionsKo: ['그레이브즈', '루시안', '아펠리오스', '코르키'],
    answer: 0
  },
  {
    text: '勇気を溜めることで相棒「スカール」に再騎乗できるチャンピオンは？',
    ko: '용기를 모아 동료 스칼에게 다시 올라탈 수 있는 챔피언은?',
    options: ['クレッド', 'セジュアニ', 'ヌヌ＆ウィルンプ', 'レル'],
    optionsKo: ['클레드', '세주아니', '누누와 윌럼프', '렐'],
    answer: 0
  },
  {
    text: '怒りが溜まると小型形態から巨大形態へ変身するチャンピオンは？',
    ko: '분노가 쌓이면 작은 형태에서 거대한 형태로 변신하는 챔피언은?',
    options: ['ナー', 'シヴァーナ', 'レネクトン', 'トリンダメア'],
    optionsKo: ['나르', '쉬바나', '레넥톤', '트린다미어'],
    answer: 0
  },
  {
    text: '茂みの中から通常攻撃すると、敵へ跳びつけるパッシブを持つチャンピオンは？',
    ko: '수풀 안에서 기본 공격을 하면 적에게 도약할 수 있는 패시브를 가진 챔피언은?',
    options: ['レンガー', 'カ＝ジックス', 'ニダリー', 'ワーウィック'],
    optionsKo: ['렝가', '카직스', '니달리', '워윅'],
    answer: 0
  },
  {
    text: '通常のジャングラーのように殴り続けず、キャンプに「木立」を作って解放するチャンピオンは？',
    ko: '일반 정글러처럼 계속 때리지 않고 캠프에 숲을 만든 뒤 해방하는 챔피언은?',
    options: ['アイバーン', 'マオカイ', 'ザイラ', 'ミリオ'],
    optionsKo: ['아이번', '마오카이', '자이라', '밀리오'],
    answer: 0
  },
  {
    text: 'アルティメットで自分そっくりの分身を作り、その分身も敵を攻撃できるチャンピオンは？',
    ko: '궁극기로 자신과 똑같은 분신을 만들고 그 분신도 적을 공격할 수 있는 챔피언은?',
    options: ['シャコ', 'ゼド', 'ニーコ', 'フィドルスティックス'],
    optionsKo: ['샤코', '제드', '니코', '피들스틱'],
    answer: 0
  },
  {
    text: '体力が低くなると分身を作って一瞬姿を消すパッシブを持つチャンピオンは？',
    ko: '체력이 낮아지면 분신을 만들고 잠시 모습을 감추는 패시브를 가진 챔피언은?',
    options: ['ルブラン', 'シャコ', 'ウーコン', 'ヴェイン'],
    optionsKo: ['르블랑', '샤코', '오공', '베인'],
    answer: 0
  },
  {
    text: 'Wで短くダッシュし、元いた場所に分身を残すチャンピオンは？',
    ko: 'W로 짧게 이동하면서 원래 있던 자리에 분신을 남기는 챔피언은?',
    options: ['ウーコン', 'ルブラン', 'エコー', 'ゼド'],
    optionsKo: ['오공', '르블랑', '에코', '제드'],
    answer: 0
  },
  {
    text: 'Rを使うと数秒前の自分の位置へ戻り、体力も回復できるチャンピオンは？',
    ko: 'R을 사용하면 몇 초 전 자신의 위치로 돌아가며 체력도 회복할 수 있는 챔피언은?',
    options: ['エコー', 'ゼド', 'ルブラン', 'リサンドラ'],
    optionsKo: ['에코', '제드', '르블랑', '리산드라'],
    answer: 0
  },
  {
    text: '敵が使ったサモナースペルや一部アイテムの欠片を拾って、自分で使えるチャンピオンは？',
    ko: '적이 사용한 소환사 주문이나 일부 아이템 조각을 주워 직접 사용할 수 있는 챔피언은?',
    options: ['ゾーイ', 'ニーコ', 'サイラス', 'ユーミ'],
    optionsKo: ['조이', '니코', '사일러스', '유미'],
    answer: 0
  },
  {
    text: 'マップ上の「チャイム」を集めることで、ミィプが強化されていくチャンピオンは？',
    ko: '맵에 있는 차임을 모으면 미프가 점점 강화되는 챔피언은?',
    options: ['バード', 'ミリオ', 'ソナ', 'タリック'],
    optionsKo: ['바드', '밀리오', '소나', '타릭'],
    answer: 0
  },
  {
    text: '倒れた敵の近くから「魂」を集め、主に防御力と魔力を伸ばしていくサポートは？',
    ko: '쓰러진 적 근처에서 영혼을 모아 주로 방어력과 주문력을 올리는 서포터는?',
    options: ['スレッシュ', 'セナ', 'スウェイン', 'カーサス'],
    optionsKo: ['쓰레쉬', '세나', '스웨인', '카서스'],
    answer: 0
  },
  {
    text: '霧の亡霊を集めることで、攻撃力・クリティカル・射程などを伸ばせるチャンピオンは？',
    ko: '안개 망령을 모아 공격력, 치명타, 사거리 등을 늘릴 수 있는 챔피언은?',
    options: ['セナ', 'スレッシュ', 'キンドレッド', 'ヴェイガー'],
    optionsKo: ['세나', '쓰레쉬', '킨드레드', '베이가'],
    answer: 0
  },
  {
    text: 'パッシブ「ドラゴンプラクティス」のスタックでスキルが成長していくチャンピオンは？',
    ko: '패시브 용 훈련 스택으로 스킬이 성장해 가는 챔피언은?',
    options: ['スモルダー', 'シヴァーナ', 'オレリオン・ソル', 'コグ＝マウ'],
    optionsKo: ['스몰더', '쉬바나', '아우렐리온 솔', '코그모'],
    answer: 0
  },
  {
    text: 'Qで敵を倒すほど、そのQのダメージが永久に増えていく代表的なチャンピオンは？',
    ko: 'Q로 적을 처치할수록 그 Q의 피해량이 영구적으로 증가하는 대표적인 챔피언은?',
    options: ['ナサス', 'レネクトン', 'ヨリック', 'トランドル'],
    optionsKo: ['나서스', '레넥톤', '요릭', '트런들'],
    answer: 0
  },
  {
    text: 'R「捕食」で敵を食べ、スタックによって最大体力や体の大きさまで増えるチャンピオンは？',
    ko: 'R 포식으로 적을 먹고 스택에 따라 최대 체력과 몸집까지 커지는 챔피언은?',
    options: ['チョ＝ガス', 'タム・ケンチ', 'ザック', 'オーン'],
    optionsKo: ['초가스', '탐 켄치', '자크', '오른'],
    answer: 0
  },
  {
    text: '「崇拝」のスタックを溜め、敵チャンピオンを倒したときに追加ゴールドへ換えるチャンピオンは？',
    ko: '숭배 스택을 모아 적 챔피언을 처치했을 때 추가 골드로 바꾸는 챔피언은?',
    options: ['ドレイヴン', 'ジン', 'パイク', 'ガングプランク'],
    optionsKo: ['드레이븐', '진', '파이크', '갱플랭크'],
    answer: 0
  },
  {
    text: '出血を最大まで重ねると「ノクサスの力」を得るチャンピオンは？',
    ko: '출혈을 최대로 중첩하면 녹서스의 힘을 얻는 챔피언은?',
    options: ['ダリウス', 'ドレイヴン', 'スウェイン', 'タロン'],
    optionsKo: ['다리우스', '드레이븐', '스웨인', '탈론'],
    answer: 0
  },
  {
    text: '味方の攻撃も協力してパッシブを4スタックまで重ねると、敵をスタンできるチャンピオンは？',
    ko: '아군의 공격도 함께 패시브를 4스택까지 쌓으면 적을 기절시킬 수 있는 챔피언은?',
    options: ['ブラウム', 'レオナ', 'ノーチラス', 'タリック'],
    optionsKo: ['브라움', '레오나', '노틸러스', '타릭'],
    answer: 0
  },
  {
    text: '「嵐の刻印」を3つ付けると敵をスタンさせるチャンピオンは？',
    ko: '폭풍의 표식을 3개 남기면 적을 기절시키는 챔피언은?',
    options: ['ケネン', 'ゼリ', 'ジェイス', 'ボリベア'],
    optionsKo: ['케넨', '제리', '제이스', '볼리베어'],
    answer: 0
  },
  {
    text: 'パッシブ「炎上」を3スタック付けた敵を爆発させ、周囲にも大きなダメージを与えるチャンピオンは？',
    ko: '패시브 불길을 3스택 쌓은 적을 폭발시켜 주변에도 큰 피해를 주는 챔피언은?',
    options: ['ブランド', 'アニー', 'ランブル', 'シンドラ'],
    optionsKo: ['브랜드', '애니', '럼블', '신드라'],
    answer: 0
  },
  {
    text: '同じ対象へ3回攻撃すると「シルバーボルト」が発動するチャンピオンは？',
    ko: '같은 대상을 3번 공격하면 은화살이 발동하는 챔피언은?',
    options: ['ヴェイン', 'カイ＝サ', 'コグ＝マウ', 'トリスターナ'],
    optionsKo: ['베인', '카이사', '코그모', '트리스타나'],
    answer: 0
  },
  {
    text: '専用アイテム「ブラックスピア」で味方1人を「契約者」にするチャンピオンは？',
    ko: '전용 아이템 검은 창으로 아군 한 명을 계약자로 만드는 챔피언은?',
    options: ['カリスタ', 'レナータ・グラスク', 'ラカン', 'ニーラ'],
    optionsKo: ['칼리스타', '레나타 글라스크', '라칸', '닐라'],
    answer: 0
  },
  {
    text: 'Rで非常に長い岩の壁を作り、その壁に乗って移動もできるチャンピオンは？',
    ko: 'R로 매우 긴 바위 벽을 만들고 그 벽을 타고 이동할 수도 있는 챔피언은?',
    options: ['タリヤ', 'アニビア', 'オーン', 'ヨリック'],
    optionsKo: ['탈리야', '애니비아', '오른', '요릭'],
    answer: 0
  },
  {
    text: 'Rの衝撃波が壁などの地形に当たると、その地形に沿って爆発が広がるチャンピオンは？',
    ko: 'R 충격파가 벽 같은 지형에 닿으면 그 지형을 따라 폭발이 퍼지는 챔피언은?',
    options: ['キヤナ', 'タリヤ', 'アカリ', 'カタリナ'],
    optionsKo: ['키아나', '탈리야', '아칼리', '카타리나'],
    answer: 0
  },
  {
    text: 'Rで指定した敵1人を六角形のエリアに閉じ込め、他の敵を外へ押し出すチャンピオンは？',
    ko: 'R로 지정한 적 한 명을 육각형 구역에 가두고 다른 적들을 밖으로 밀어내는 챔피언은?',
    options: ['カミール', 'モルデカイザー', 'ジャーヴァンⅣ', 'シン・ジャオ'],
    optionsKo: ['카밀', '모데카이저', '자르반 4세', '신 짜오'],
    answer: 0
  },
  {
    text: 'Wの霧の外にいる敵から、基本的に対象指定もダメージも受けなくなるチャンピオンは？',
    ko: 'W 안개 밖에 있는 적에게 기본적으로 지정 대상이 되지 않고 피해도 받지 않는 챔피언은?',
    options: ['グウェン', 'アカリ', 'ヴェイン', 'ケイル'],
    optionsKo: ['그웬', '아칼리', '베인', '케일'],
    answer: 0
  },
  {
    text: '潜伏中、視界がなくても「動いている敵」の位置を振動として感じ取れるチャンピオンは？',
    ko: '매복 상태에서 시야가 없어도 움직이는 적의 위치를 진동으로 감지할 수 있는 챔피オン은?',
    options: ['レク＝サイ', 'カ＝ジックス', 'イブリン', 'レンガー'],
    optionsKo: ['렉사이', '카직스', '이블린', '렝가'],
    answer: 0
  },
  {
    text: '近くに味方がいない敵を「孤立」状態として扱い、スキルが強化されるチャンピオンは？',
    ko: '주변에 아군이 없는 적을 고립 상태로 취급해 스킬이 강화되는 챔피언은?',
    options: ['カ＝ジックス', 'レンガー', 'ベル＝ヴェス', 'ケイン'],
    optionsKo: ['카직스', '렝가', '벨베스', '케인'],
    answer: 0
  },
  {
    text: 'Wで敵にハート型の印を付け、十分待ってから攻撃するとチャームできるチャンピオンは？',
    ko: 'W로 적에게 하트 모양 표식을 남기고 충분히 기다린 뒤 공격하면 매혹할 수 있는 챔피언은?',
    options: ['イブリン', 'アーリ', 'セラフィーン', 'ラカン'],
    optionsKo: ['이블린', '아리', '세라핀', '라칸'],
    answer: 0
  },
  {
    text: 'ヒートが100になると「オーバーヒート」し、一時的にスキルが使えなくなるチャンピオンは？',
    ko: '열기가 100이 되면 과열되어 잠시 스킬을 사용할 수 없게 되는 챔피언은?',
    options: ['ランブル', 'ブライアー', 'レネクトン', 'シヴァーナ'],
    optionsKo: ['럼블', '브라이어', '레넥톤', '쉬바나'],
    answer: 0
  },
  {
    text: '「星屑」を集めるほど複数のスキルそのものが成長していくチャンピオンは？',
    ko: '별가루를 모을수록 여러 스킬 자체가 성장해 가는 챔피언은?',
    options: ['オレリオン・ソル', 'スモルダー', 'ヴェイガー', 'シンドラ'],
    optionsKo: ['아우렐리온 솔', '스몰더', '베이가', '신드라'],
    answer: 0
  },
  {
    text: '「ハンド・オブ・バロン」を持つチャンピオンの近くで、特に強化されるものは？',
    ko: '바론의 권능을 가진 챔피언 근처에서 특히 강화되는 것은?',
    options: ['味方ミニオン', '味方ワード', '味方タワー', 'ジャングル植物'],
    optionsKo: ['아군 미니언', '아군 와드', '아군 포탑', '정글 식물'],
    answer: 0
  },
  {
    text: '低体力の敵へダメージを与えたとき、強力な「処刑」効果につながるバフを得られる大型オブジェクトは？',
    ko: '체력이 낮은 적에게 피해를 주면 강력한 처형 효과로 이어지는 버프를 주는 대형 오브젝트는?',
    options: ['エルダードラゴン', 'バロン・ナッシャー', 'リフトヘラルド', 'リフトスカトル'],
    optionsKo: ['장로 드래곤', '내셔 남작', '협곡의 전령', '협곡 바위 게'],
    answer: 0
  },
  {
    text: '倒すと川に「スピードの祠」を作り、周辺の視界にも役立つ中立モンスターは？',
    ko: '처치하면 강에 속도의 성소를 만들고 주변 시야에도 도움이 되는 중립 몬스터는?',
    options: ['リフトスカトル', 'ヴォイドグラブ', 'ブルーセンチネル', 'クリムゾンラプター'],
    optionsKo: ['협곡 바위 게', '공허 유충', '푸른 파수꾼', '핏빛 칼날부리'],
    answer: 0
  },
  {
    text: '攻撃すると、近くのユニットを爆風で弾き飛ばすジャングル植物は？',
    ko: '공격하면 근처 유닛을 폭발로 밀어내는 정글 식물은?',
    options: ['ブラストコーン', 'スクライヤーブルーム', 'ハニーフルーツ', 'フェイライト'],
    optionsKo: ['솔방울탄', '수정초', '꿀열매', '페이라이트'],
    answer: 0
  },
  {
    text: '攻撃した方向へ広い範囲の視界を飛ばし、敵チャンピオンやワードの発見に使える植物は？',
    ko: '공격한 방향으로 넓은 시야를 보내 적 챔피언이나 와드를 찾는 데 쓰는 식물은?',
    options: ['スクライヤーブルーム', 'ブラストコーン', 'ハニーフルーツ', 'レッドブランブルバック'],
    optionsKo: ['수정초', '솔방울탄', '꿀열매', '붉은 덩굴정령'],
    answer: 0
  },
  {
    text: '敵インヒビターを破壊した後、そのレーンの味方ウェーブに追加される特別なミニオンは？',
    ko: '적 억제기를 파괴한 뒤 그 라인의 아군 미니언 웨이브에 추가되는 특별한 미니언은?',
    options: ['スーパーミニオン', 'エリートミニオン', 'バロンミニオン', 'ネクサスミニオン'],
    optionsKo: ['슈퍼 미니언', '엘리트 미니언', '바론 미니언', '넥서스 미니언'],
    answer: 0
  },
  {
    text: '敵ネクサス本体を攻撃可能にするため、直前に破壊する必要がある建造物は？',
    ko: '적 넥서스 본체를 공격 가능하게 만들기 위해 바로 전에 파괴해야 하는 구조물은?',
    options: ['2本のネクサスタワー', '全ての外側タワー', '全てのインヒビター', 'バロンピット'],
    optionsKo: ['넥서스 포탑 2개', '모든 외곽 포탑', '모든 억제기', '바론 둥지'],
    answer: 0
  },
  {
    text: '「ヘラルドの瞳」を使用すると、自チーム側として召喚できる大型モンスターは？',
    ko: '전령의 눈을 사용하면 아군 편으로 소환할 수 있는 대형 몬스터는?',
    options: ['リフトヘラルド', 'バロン・ナッシャー', 'エルダードラゴン', 'アタカン'],
    optionsKo: ['협곡의 전령', '내셔 남작', '장로 드래곤', '아타칸'],
    answer: 0
  },
  {
    text: '2024年、LoL Esports「Hall of Legends」の最初の殿堂入り選手になったのは？',
    ko: '2024년 LoL Esports 명예의 전당 Hall of Legends의 첫 헌액자는?',
    options: ['Faker', 'Uzi', 'Deft', 'Rookie'],
    optionsKo: ['페이커', '우지', '데프트', '루키'],
    answer: 0
  },
  {
    text: '2025年、Hall of Legendsの2人目の殿堂入り選手になったのは？',
    ko: '2025년 Hall of Legends의 두 번째 헌액자가 된 선수는?',
    options: ['Uzi', 'Deft', 'Caps', 'Mata'],
    optionsKo: ['우지', '데프트', '캡스', '마타'],
    answer: 0
  },
  {
    text: 'Fakerの2024 Hall of Legendsを象徴する「不滅なる伝説」スキンのチャンピオンは？',
    ko: '페이커의 2024 Hall of Legends를 상징하는 불멸의 전설 스킨 챔피언은?',
    options: ['アーリ', 'ルブラン', 'サイラス', 'アジール'],
    optionsKo: ['아리', '르블랑', '사일러스', '아지르'],
    answer: 0
  },
  {
    text: 'Uziの2025 Hall of Legendsを象徴する「不滅なる伝説」スキンのチャンピオンは？',
    ko: '우지의 2025 Hall of Legends를 상징하는 불멸의 전설 스킨 챔피언은?',
    options: ['カイ＝サ', 'ヴェイン', 'エズリアル', 'ルシアン'],
    optionsKo: ['카이사', '베인', '이즈리얼', '루시안'],
    answer: 0
  },
  {
    text: 'Uziが歴史的に最も有名になったロールは？',
    ko: '우지가 역사적으로 가장 유명해진 포지션은?',
    options: ['ボット／マークスマン', 'トップ', 'ジャングル', 'サポート'],
    optionsKo: ['바텀/원거리 딜러', '탑', '정글', '서포터'],
    answer: 0
  },
  {
    text: '2023 World Championshipを制したチームは？',
    ko: '2023 월드 챔피언십에서 우승한 팀은?',
    options: ['T1', 'Weibo Gaming', 'Gen.G', 'JD Gaming'],
    optionsKo: ['T1', '웨이보 게이밍', '젠지', '징동 게이밍'],
    answer: 0
  },
  {
    text: '2024 WorldsのMVP Fakerを称えるプレステージT1スキンに選ばれたチャンピオンは？',
    ko: '2024 월즈 MVP 페이커를 기념하는 프레스티지 T1 스킨의 챔피언은?',
    options: ['サイラス', 'アーリ', 'ヨネ', 'アジール'],
    optionsKo: ['사일러스', '아리', '요네', '아지르'],
    answer: 0
  },
  {
    text: '2023・2024・2025とWorldsを3年連続で制し、史上初の3連覇を達成したチームは？',
    ko: '2023·2024·2025 월즈를 3년 연속 우승해 역사상 최초의 3연패를 달성한 팀은?',
    options: ['T1', 'Gen.G', 'DRX', 'Bilibili Gaming'],
    optionsKo: ['T1', '젠지', 'DRX', '빌리빌리 게이밍'],
    answer: 0
  }
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
    for (let i = 0; i < 4; i++) {
      if (i !== target) arranged[i] = wrongChoices[wi++];
    }
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
    const text = String(q?.text || '').trim().slice(0, 220);
    const ko = String(q?.ko || '').trim().slice(0, 220);
    const options = Array.isArray(q?.options)
      ? q.options.slice(0, 4).map(x => String(x || '').trim().slice(0, 100))
      : [];
    const optionsKo = Array.isArray(q?.optionsKo)
      ? q.optionsKo.slice(0, 4).map(x => String(x || '').trim().slice(0, 100))
      : ['', '', '', ''];
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
  }, 4800);
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
      questions: DEFAULT_QUESTIONS.map(q => ({
        ...q,
        options: [...q.options],
        optionsKo: [...q.optionsKo]
      })),
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
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    if (room.questions.length < 1) return;
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
    if (!room || room.status !== 'playing' || room.questionResolved || !room.players.has(socket.id)) return;
    if (room.answered.has(socket.id)) return;
    const idx = Number(answerIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) return;

    room.answered.add(socket.id);
    room.answers.set(socket.id, idx);
    const q = room.playQuestions[room.questionIndex];
    const elapsed = Date.now() - room.questionStartedAt;
    const totalMs = room.secondsPerQuestion * 1000;
    const correct = idx === q.answer;
    let gained = 0;
    if (correct) {
      const remainingRatio = Math.max(0, 1 - elapsed / totalMs);
      gained = Math.round(500 + 500 * remainingRatio);
      room.players.get(socket.id).score += gained;
    }
    socket.emit('answer-locked', { gained });
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
