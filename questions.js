const genshinQuestions = [
  { text:'【七神】モンドで「バルバトス」と呼ばれる風神の現在の姿は？', ko:'【일곱 신】몬드에서 바르바토스라 불리는 바람의 신의 현재 모습은?', options:['ウェンティ','ジン','ディルック','アルベド'], optionsKo:['벤티','진','다이루크','알베도'], answer:0 },
  { text:'【七神】璃月で「モラクス」と呼ばれた岩神の人間としての名は？', ko:'【일곱 신】리월에서 모락스라 불린 바위 신의 인간 이름은?', options:['鍾離','魈','タルタリヤ','白朮'], optionsKo:['종려','소','타르탈리아','백출'], answer:0 },
  { text:'【七神】稲妻の雷神「バアルゼブル」の正体である人物は？', ko:'【일곱 신】이나즈마의 번개 신 바알세불의 정체는?', options:['雷電影','雷電眞','八重神子','九条裟羅'], optionsKo:['라이덴 에이','라이덴 마코토','야에 미코','쿠죠 사라'], answer:0 },
  { text:'【七神】スメールで「ブエル」という魔神名を持つ神は？', ko:'【일곱 신】수메르에서 부에르라는 마신명을 가진 신은?', options:['ナヒーダ','マハールッカデヴァータ','ニィロウ','アルハイゼン'], optionsKo:['나히다','룩카데바타','닐루','알하이탐'], answer:0 },
  { text:'【フォンテーヌ】ヌヴィレットの正体として最も正しいものは？', ko:'【폰타인】느비예트의 정체로 가장 정확한 것은?', options:['水の龍王','先代水神','ファデュイ執行官','純水精霊の王'], optionsKo:['물의 용왕','선대 물의 신','우인단 집행관','물의 정령의 왕'], answer:0 },
  { text:'【ファデュイ】「公子」タルタリヤは執行官第何位？', ko:'【우인단】타르탈리아는 집행관 몇 위인가?', options:['第11位','第8位','第6位','第4位'], optionsKo:['11위','8위','6위','4위'], answer:0 },
  { text:'【ファデュイ】「淑女」シニョーラは執行官第何位だった？', ko:'【우인단】시뇨라는 집행관 몇 위였나?', options:['第8位','第2位','第6位','第11位'], optionsKo:['8위','2위','6위','11위'], answer:0 },
  { text:'【ファデュイ】スカラマシュがファデュイを離れる前の執行官順位は？', ko:'【우인단】스카라무슈가 떠나기 전 순위는?', options:['第6位','第3位','第7位','第9位'], optionsKo:['6위','3위','7위','9위'], answer:0 },
  { text:'【ファデュイ】「召使」アルレッキーノの執行官順位は？', ko:'【우인단】아를레키노의 집행관 순위는?', options:['第4位','第5位','第3位','第10位'], optionsKo:['4위','5위','3위','10위'], answer:0 },
  { text:'【ファデュイ】「博士」ドットーレの執行官順位は？', ko:'【우인단】도토레의 집행관 순위는?', options:['第2位','第1位','第3位','第5位'], optionsKo:['2위','1위','3위','5위'], answer:0 },
  { text:'【モンド】西風騎士団で代理団長を務める人物は？', ko:'【몬드】페보니우스 기사단 단장 대행은?', options:['ジン','リサ','ガイア','エウルア'], optionsKo:['진','리사','케이아','유라'], answer:0 },
  { text:'【璃月】璃月七星の「天権」を務める人物は？', ko:'【리월】리월 칠성의 천권은?', options:['凝光','刻晴','甘雨','夜蘭'], optionsKo:['응광','각청','감우','야란'], answer:0 },
  { text:'【稲妻】社奉行を担う一族は？', ko:'【이나즈마】야시로 봉행을 담당하는 가문은?', options:['神里家','九条家','柊家','楓原家'], optionsKo:['카미사토 가문','쿠죠 가문','히이라기 가문','카에데하라 가문'], answer:0 },
  { text:'【スメール】「大マハマトラ」の肩書きを持つ人物は？', ko:'【수메르】대풍기관이라는 직책을 가진 인물은?', options:['セノ','ティナリ','カーヴェ','ディシア'], optionsKo:['사이노','타이나리','카베','데히야'], answer:0 },
  { text:'【フォンテーヌ】「棘薔薇の会」の会長は？', ko:'【폰타인】가시 장미회의 회장은?', options:['ナヴィア','クロリンデ','シャルロット','千織'], optionsKo:['나비아','클로린드','샤를로트','치오리'], answer:0 },
  { text:'【スメール・設定】ナヒーダより前の草神として知られる存在は？', ko:'【수메르】나히다 이전의 풀의 신은?', options:['マハールッカデヴァータ','花神','キングデシェレト','アペプ'], optionsKo:['룩카데바타','화신','적왕','아펩'], answer:0 },
  { text:'【世界観】ダインスレイヴの故郷は？', ko:'【세계관】데인슬레이프의 고향은?', options:['カーンルイア','モンド','スネージナヤ','フォンテーヌ'], optionsKo:['켄리아','몬드','스네즈나야','폰타인'], answer:0 },
  { text:'【世界観】ガイアの姓「アルベリヒ」が特に深く結びつく国は？', ko:'【세계관】케이아의 성 알베리히와 깊게 연결된 나라는?', options:['カーンルイア','璃月','稲妻','ナタ'], optionsKo:['켄리아','리월','이나즈마','나타'], answer:0 },
  { text:'【フォンテーヌ・設定】メリュジーヌ誕生の起源と深く関係する巨大な存在は？', ko:'【폰타인】멜뤼진의 기원과 깊게 관련된 존재는?', options:['エリナス','アペプ','若陀龍王','トワリン'], optionsKo:['엘리나스','아펩','야타용왕','드발린'], answer:0 },
  { text:'【フォンテーヌ・歴史】フォカロルスより前の水神は？', ko:'【폰타인】포칼로스 이전의 물의 신은?', options:['エゲリア','レムス','ナベリウス','デカラビアン'], optionsKo:['에게리아','레무스','나베리우스','데카라비안'], answer:0 },
  { text:'【フォンテーヌ】審判装置「諭示裁定カーディナル」が置かれている場所は？', ko:'【폰타인】심판 장치 「오라트리스」가 있는 곳은?', options:['エピクレシス歌劇場','メロピデ要塞','フォンテーヌ廷','ポワソン町'], optionsKo:['에피클레스 오페라 하우스','메로피드 요새','폰타인성','푸아송 마을'], answer:0 },
  { text:'【フォンテーヌ】メロピデ要塞の管理者は？', ko:'【폰타인】메로피드 요새의 관리자는?', options:['リオセスリ','ヌヴィレット','リネ','フレミネ'], optionsKo:['라이오슬리','느비예트','리니','프레미네'], answer:0 },
  { text:'【フォンテーヌ・核心】神としてのフォカロルスが最後に行ったこととして正しいのは？', ko:'【폰타인】포칼로스가 마지막에 한 일로 맞는 것은?', options:['水神の神座を破壊し、水元素の権能をヌヴィレットへ返した','氷神へ神の心を渡した','フォンテーヌを海上へ移動させた','天理を直接倒した'], optionsKo:['물의 신 신좌를 파괴하고 권능을 느비예트에게 돌려줬다','얼음 신에게 신의 심장을 넘겼다','폰타인을 바다 위로 이동시켰다','천리를 직접 쓰러뜨렸다'], answer:0 },
  { text:'【フォンテーヌ・核心】フォンテーヌ人の起源として明かされたものは？', ko:'【폰타인】폰타인 사람들의 기원은?', options:['エゲリアが人の姿にした純水精霊','カーンルイアから逃げた人々','仙人の子孫','龍族が直接人間化した存在'], optionsKo:['에게리아가 인간 모습으로 만든 물의 정령','켄리아에서 탈출한 사람들','선인의 후손','용족이 직접 인간화한 존재'], answer:0 },
  { text:'【フォンテーヌ・核心】原始胎海の水が、かつてフォンテーヌ人に引き起こした現象は？', ko:'【폰타인】원시 모태 바다의 물이 일으킨 현상은?', options:['身体が溶けて水へ還る','元素力を永久に失う','石化する','眠り続ける'], optionsKo:['몸이 녹아 물로 돌아간다','원소 능력을 영구히 잃는다','석화한다','계속 잠든다'], answer:0 },
  { text:'【元素反応】草元素＋雷元素で最初に発生する反応は？', ko:'【원소 반응】풀+번개로 처음 발생하는 반응은?', options:['原激化','開花','燃焼','超開花'], optionsKo:['활성','개화','연소','만개'], answer:0 },
  { text:'【元素反応】草原核に雷元素を当てると発生する反応は？', ko:'【원소 반응】풀 원핵에 번개를 맞히면?', options:['超開花','烈開花','燃焼','感電'], optionsKo:['만개','발화','연소','감전'], answer:0 },
  { text:'【元素反応】草原核に炎元素を当てると発生する反応は？', ko:'【원소 반응】풀 원핵에 불을 맞히면?', options:['烈開花','超開花','蒸発','溶解'], optionsKo:['발화','만개','증발','융해'], answer:0 },
  { text:'【元素反応】次のうち、岩元素と結晶反応を起こさない元素は？', ko:'【원소 반응】바위와 결정 반응을 일으키지 않는 원소는?', options:['草元素','炎元素','水元素','氷元素'], optionsKo:['풀','불','물','얼음'], answer:0 },
  { text:'【フォンテーヌ・システム】アルケーの2つの性質は？', ko:'【폰타인】아르케의 두 성질은?', options:['プネウマとウーシア','陰と陽','光と闇','生と滅'], optionsKo:['프뉴마와 우시아','음과 양','빛과 어둠','생과 멸'], answer:0 }
];

const valuePrompts = [
  { text:'友達になるなら一番ほしいタイプは？', options:['とにかく面白い','絶対に秘密を守る','どこでも誘ってくれる','困った時に頼れる'] },
  { text:'1年間だけ能力を1つ強化できるなら？', options:['頭の回転','コミュ力','運動神経','運の良さ'] },
  { text:'放課後に急に3時間空いたら？', options:['カラオケ','ご飯・カフェ','ゲーム','適当に街を歩く'] },
  { text:'一生どれか1つだけ待ち時間ゼロになるなら？', options:['病院','テーマパーク','飲食店','電車・バス'] },
  { text:'友達グループで一番大事なのは？', options:['ノリが合う','気を使わない','信頼できる','趣味が合う'] },
  { text:'朝起きたら1つだけ完璧になっていた。どれがいい？', options:['英語','料理','歌','スポーツ'] },
  { text:'一生どれかの通知しか来ないなら？', options:['LINE','電話','SNS','ゲーム'] },
  { text:'旅行で予定が1つ潰れた。どうする？', options:['すぐ別案を探す','近くを適当に歩く','ホテルで休む','友達に全部任せる'] },
  { text:'一番テンションが上がる「急な予定」は？', options:['友達から遊びの誘い','休校','臨時のお小遣い','好きな店の限定イベント'] },
  { text:'友達に1つだけ自分の能力を貸せるなら？', options:['集中力','記憶力','体力','コミュ力'] },
  { text:'文化祭でやるなら一番参加したいのは？', options:['お化け屋敷','飲食店','ステージ企画','ゲーム・謎解き'] },
  { text:'スマホから1つだけ広告を永久に消せるなら？', options:['YouTube','SNS','ゲーム','Webサイト'] },
  { text:'もし1日が30時間になったら増えた6時間は？', options:['寝る','遊ぶ','勉強・仕事','何もせずダラダラ'] },
  { text:'一生どれかの失敗をしなくなるなら？', options:['遅刻','忘れ物','言い間違い','買い物の後悔'] },
  { text:'友達とご飯に行く時、一番うれしい決め方は？', options:['人気店を予約','安くてうまい店','その場のノリ','誰かのおすすめ'] },
  { text:'1週間だけ住めるなら？', options:['東京のど真ん中','沖縄の海の近く','北海道の自然の中','海外の大都市'] },
  { text:'一番イヤなスマホトラブルは？', options:['充電できない','写真が全部消える','Wi-Fiが使えない','画面がずっと暗い'] },
  { text:'自分の部屋に無料で1つ追加できるなら？', options:['超高性能PC','巨大テレビ','最高級ベッド','小型冷蔵庫'] },
  { text:'テストで1教科だけ毎回満点になるなら？', options:['国語','数学','英語','好きな専門科目'] },
  { text:'友達から言われたら一番うれしいのは？', options:['一緒にいると楽しい','頼りになる','話しやすい','センスいい'] },
  { text:'一生1つだけ食べ放題になるなら？', options:['焼肉','寿司','ラーメン','スイーツ'] },
  { text:'毎日必ず1時間やらないといけないなら？', options:['運動','読書','掃除','勉強'] },
  { text:'明日だけ誰にもバレずに休めるなら？', options:['家で寝る','一人で遊びに行く','友達と遊ぶ','結局いつも通り行く'] },
  { text:'友達とのLINE、どれが一番楽？', options:['ずっと短文','スタンプ多め','電話に切り替える','返したい時だけ返す'] },
  { text:'一生どれか1つだけ絶対に失くさないなら？', options:['スマホ','財布','イヤホン','鍵'] },
  { text:'もし自分の人生にゲームの機能を1つ追加できるなら？', options:['セーブ＆ロード','ステータス表示','高速移動','クエスト案内'] },
  { text:'急に有名人になったら一番困りそうなのは？', options:['街で気づかれる','SNSを見られる','昔の話を掘られる','自由に遊べない'] },
  { text:'1日だけ学校のルールを1つ変えられるなら？', options:['登校時間を遅くする','授業を短くする','スマホ完全自由','昼休みを2倍にする'] },
  { text:'一生どちらかと言われたら一番マシなのは？', options:['夏しかない','冬しかない','平日しかない','休日しかない'] },
  { text:'突然10連休になった。初日にすることは？', options:['寝まくる','旅行を計画','友達を誘う','ゲーム・動画を開始'] }
];

const oneLinerPrompts = [
  '絶対に誰も押したくない「謎のボタン」。横に何と書いてある？','先生が「今日は教科書を閉じて」と言った直後、何が始まった？','世界一信用できない天気予報の一言とは？','友達から届いた「今すぐ来て」の理由がしょうもなすぎた。何だった？','新発売のスマホ、たった1つの致命的な欠点とは？','このコンビニ、店長がゲーム好きすぎる。どんな店？','絶対に乗りたくない新幹線の新サービスとは？','校長先生が突然YouTuberになった。最初の動画タイトルは？','「このAI、絶対サボってるな」と思った返答とは？','未来の学校で廃止されていそうなものは？','世界一弱い超能力なのに、本人だけ自信満々。どんな能力？','友達が急に「俺、今日から主人公になるわ」。最初にしたことは？','100点を取ったのに先生に心配された。なぜ？','絶対に流行らないSNSの新機能とは？','「このホテル、口コミ1.2なの納得だわ」何があった？','ゲームのラスボスが戦う前に言った、やる気ゼロの一言とは？','自動販売機に見たことのないボタンが1つ。押すとどうなる？','世界一しょうもない世界記録とは？','友達のスマホの待ち受けを見て全員が黙った。何が写っていた？','新しい学校行事「○○大会」。絶対にやりたくない内容とは？','宇宙人が日本に来て最初にハマったものとは？','「このレストラン、注文方法が難しすぎる」どんなシステム？','もしWi-Fiに性格があったら、一番イヤな性格とは？','寝坊した人だけが使える特殊能力とは？','世界一優しい不良が言いそうなセリフとは？','「このヒーロー、絶対人気出ると思ってないだろ」どんな必殺技？','友達が「5分だけ待って」と言ってから3時間。何をしていた？','学校の購買に突然追加された謎すぎる商品とは？','未来人が2026年を見て一番驚いたこととは？','神様がアップデートで人間に追加した、いらなすぎる新機能とは？'
];

const wordPairs = [['犬','猫'],['ラーメン','うどん'],['寿司','焼肉'],['カレー','シチュー'],['たこ焼き','お好み焼き'],['ケーキ','アイス'],['コーヒー','紅茶'],['コーラ','サイダー'],['ポテト','ナゲット'],['コンビニ','スーパー'],['マクドナルド','モスバーガー'],['スターバックス','タリーズ'],['YouTube','TikTok'],['Instagram','X（Twitter）'],['LINE','Discord'],['iPhone','Android'],['イヤホン','ヘッドホン'],['ゲーム','アニメ'],['映画館','カラオケ'],['遊園地','水族館'],['ディズニーランド','USJ'],['温泉','サウナ'],['海','プール'],['山','海'],['夏','冬'],['雨','雪'],['朝','夜'],['都会','田舎'],['電車','バス'],['自転車','徒歩'],['ホテル','旅館'],['文化祭','体育祭'],['テスト','宿題'],['数学','英語'],['先生','先輩'],['教室','体育館'],['昼休み','放課後'],['寝坊','遅刻'],['スマホ','パソコン'],['写真','動画'],['電話','メッセージ'],['友達','親友'],['初恋','片思い'],['プレゼント','手紙'],['秘密','黒歴史'],['天才','努力家'],['ヒーロー','悪役'],['透明人間','瞬間移動'],['未来予知','時間停止'],['宇宙','深海'],['幽霊','宇宙人'],['魔法','超能力'],['宝くじ','お年玉'],['100万円','1か月休み'],['無人島','雪山'],['世界旅行','豪華な家']].map(([a,b])=>({a,b}));

const titleScenes = [
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Funny%20monkey.jpg?width=1000',credit:'Steven Kreuzer / Public Domain',source:'https://commons.wikimedia.org/wiki/File:Funny_monkey.jpg'},
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Funny_Monkey_walk.jpg?width=1000',credit:'Rajani Gairshail / CC0',source:'https://commons.wikimedia.org/wiki/File:Funny_Monkey_walk.jpg'},
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Gracie_Seyranian_the_chunky_cat%2C_she%E2%80%99s_a_funny_cat_but_she%E2%80%99s_angry.jpg?width=1000',credit:'TyedyeBrody / CC0',source:'https://commons.wikimedia.org/wiki/File:Gracie_Seyranian_the_chunky_cat,_she%E2%80%99s_a_funny_cat_but_she%E2%80%99s_angry.jpg'},
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Tigger_Seyranian_the_Muffin_Cat%2C_Kitten_sitting_funny.jpg?width=1000',credit:'TyedyeBrody / CC0',source:'https://commons.wikimedia.org/wiki/File:Tigger_Seyranian_the_Muffin_Cat,_Kitten_sitting_funny.jpg'},
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Funny_Horse_%28166725609%29.jpeg?width=1000',credit:'Loïc Lété / CC0',source:'https://commons.wikimedia.org/wiki/File:Funny_Horse_(166725609).jpeg'},
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Funny_goat.jpg?width=1000',credit:'AdaAndMargaret / CC BY-SA 4.0',source:'https://commons.wikimedia.org/wiki/File:Funny_goat.jpg'},
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Funny_dog.jpg?width=1000',credit:'mikapon / CC BY-SA 2.0',source:'https://commons.wikimedia.org/wiki/File:Funny_dog.jpg'},
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Funny_Horse_Faces.jpg?width=1000',credit:'Jussi You-S-See / CC BY-SA 2.0',source:'https://commons.wikimedia.org/wiki/File:Funny_Horse_Faces.jpg'},
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Funny_cat_posing_%2814250377907%29.jpg?width=1000',credit:'Vladimir Pustovit / CC BY 2.0',source:'https://commons.wikimedia.org/wiki/File:Funny_cat_posing_(14250377907).jpg'},
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Funny_cat_posing_%2814436816385%29.jpg?width=1000',credit:'Vladimir Pustovit / CC BY 2.0',source:'https://commons.wikimedia.org/wiki/File:Funny_cat_posing_(14436816385).jpg'},
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Funny_cat_%286225537439%29.jpg?width=1000',credit:'Moyan Brenn / CC BY 2.0',source:'https://commons.wikimedia.org/wiki/File:Funny_cat_(6225537439).jpg'},
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Two_funny_dog.jpg?width=1000',credit:'Jeeva Srinivasan / CC BY-SA 4.0',source:'https://commons.wikimedia.org/wiki/File:Two_funny_dog.jpg'},
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Funny_dog_%285893408392%29.jpg?width=1000',credit:'Fedor Leukhin / CC BY-SA 2.0',source:'https://commons.wikimedia.org/wiki/File:Funny_dog_(5893408392).jpg'},
  {image:'https://commons.wikimedia.org/wiki/Special:FilePath/Funny_goat_%285338044248%29.jpg?width=1000',credit:'Miia Ranta / Wikimedia Commons',source:'https://commons.wikimedia.org/wiki/File:Funny_goat_(5338044248).jpg'}
];

module.exports={genshinQuestions,valuePrompts,oneLinerPrompts,wordPairs,titleScenes};