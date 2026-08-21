module.exports = [
  // ===== チャンピオン相互作用・特殊仕様：5問 =====
  { text: '【極・チャンピオン】カシオペアが他の通常チャンピオンと違い、ショップで購入できない装備カテゴリは？', ko: '【극・챔피언】카시오페아가 다른 일반 챔피언과 달리 상점에서 구매할 수 없는 아이템 분류는?', options: ['ブーツ', '防具', 'APアイテム', '消耗品'], optionsKo: ['신발', '방어 아이템', 'AP 아이템', '소모품'], answer: 0 },
  { text: '【極・チャンピオン】ヴィエゴが敵チャンピオンを憑依した直後、基本的に借りられないものは？', ko: '【극・챔피언】비에고가 적 챔피언을 빙의한 직후 기본적으로 빌려 쓰지 못하는 것은?', options: ['その敵のアルティメット', 'その敵の通常スキル', 'その敵の通常攻撃', 'その敵のアイテム効果'], optionsKo: ['그 적의 궁극기', '그 적의 일반 스킬', '그 적의 기본 공격', '그 적의 아이템 효과'], answer: 0 },
  { text: '【極・チャンピオン】フィドルスティックスのトリンケットが通常ワードの代わりに変化するものは？', ko: '【극・챔피언】피들스틱의 장신구가 일반 와드 대신 바뀌는 것은?', options: ['フィドルスティックスそっくりの人形', 'コントロールワード', '移動するミニオン', '小型タワー'], optionsKo: ['피들스틱과 똑같이 생긴 허수아비', '제어 와드', '움직이는 미니언', '소형 포탑'], answer: 0 },
  { text: '【極・チャンピオン】ヤスオRを敵に使用するために必要な敵側の状態は？', ko: '【극・챔피언】야스오가 적에게 R을 사용하기 위해 필요한 적의 상태는?', options: ['Airborne状態', 'Root状態', 'Silence状態', 'Blind状態'], optionsKo: ['공중에 뜬 상태', '속박 상태', '침묵 상태', '실명 상태'], answer: 0 },
  { text: '【極・チャンピオン】ランブルがDanger Zoneを超えてオーバーヒートすると、短時間どうなる？', ko: '【극・챔피언】럼블이 위험 구간을 넘어 과열되면 잠시 어떻게 되는가?', options: ['スキルを使えなくなる代わりに通常攻撃が強化される', '通常攻撃ができなくなる', '完全無敵になる', '強制的にリコールする'], optionsKo: ['스킬을 못 쓰는 대신 기본 공격이 강화된다', '기본 공격을 못 하게 된다', '완전 무적이 된다', '강제로 귀환한다'], answer: 0 },

  // ===== CC・ゲーム判定：5問 =====
  { text: '【極・CC】Tenacity（行動妨害耐性）で基本的に持続時間を短縮できないCCは？', ko: '【극・CC】강인함으로 기본적으로 지속시간을 줄일 수 없는 CC는?', options: ['Airborne', 'Stun', 'Root', 'Fear'], optionsKo: ['에어본', '기절', '속박', '공포'], answer: 0 },
  { text: '【極・CC】Cleanseで基本的に解除できないものは？', ko: '【극・CC】정화로 기본적으로 해제할 수 없는 것은?', options: ['Suppression', 'Charm', 'Fear', 'Stun'], optionsKo: ['제압', '매혹', '공포', '기절'], answer: 0 },
  { text: '【極・CC】Spell Shieldが正常に発動した場合の基本的な挙動は？', ko: '【극・CC】주문 방어막이 정상적으로 발동했을 때 기본적인 동작은?', options: ['次に受ける敵スキル1回を無効化する', '通常攻撃を永続無効化する', '全CCを10秒間無効化する', '敵のスキルを反射する'], optionsKo: ['다음에 받는 적 스킬 1회를 무효화한다', '기본 공격을 영구 무효화한다', '모든 CC를 10초 동안 무효화한다', '적 스킬을 반사한다'], answer: 0 },
  { text: '【極・CC】「Grounded」と「Root」の違いとして最も正しいものは？', ko: '【극・CC】고정(Grounded)과 속박(Root)의 차이로 가장 맞는 것은?', options: ['Groundedは歩けるが移動スキルを使えず、Rootは歩くこともできない', 'Groundedは通常攻撃不可、Rootは可能', 'Groundedは無敵、Rootは対象指定不可', '両者は完全に同じ'], optionsKo: ['고정은 걸을 수 있지만 이동 스킬을 못 쓰고, 속박은 걸어서 이동도 못 한다', '고정은 기본 공격 불가, 속박은 가능', '고정은 무적, 속박은 대상 지정 불가', '둘은 완전히 같다'], answer: 0 },
  { text: '【極・CC】Displacement Immunityが主に防ぐものは？', ko: '【극・CC】변위 면역이 주로 막는 것은?', options: ['ノックバックや引き寄せなどによる強制移動', '通常攻撃ダメージ', '視界獲得', 'スロウだけ'], optionsKo: ['넉백이나 끌어당김 같은 강제 이동', '기본 공격 피해', '시야 획득', '둔화만'], answer: 0 },

  // ===== 高級マクロ・ウェーブ・視界：5問 =====
  { text: '【極・マクロ】「Cheater Recall」の狙いとして最も近いものは？', ko: '【극・매크로】치터 리콜의 주된 목적에 가장 가까운 것은?', options: ['序盤にウェーブを作って先にリコールし、損失を抑えて買い物差を作る', '敵ジャングルを全て奪う', 'レベル1でタワーを破壊する', 'ドラゴンをノーダメージで取る'], optionsKo: ['초반 웨이브를 만든 뒤 먼저 귀환해 손실을 줄이고 구매 차이를 만든다', '적 정글을 전부 빼앗는다', '레벨 1에 포탑을 파괴한다', '드래곤을 노데미지로 잡는다'], answer: 0 },
  { text: '【極・マクロ】「Slow Push」を作る基本的な考え方は？', ko: '【극・매크로】슬로우 푸시를 만드는 기본적인 방식은?', options: ['敵ミニオンを少しずつ減らし、味方ウェーブを徐々に大きくする', '全スキルで即座にウェーブを消す', '一切CSを取らず敵だけ増やす', '必ず敵タワー下でFreezeする'], optionsKo: ['적 미니언을 조금씩 줄여 아군 웨이브를 점점 크게 만든다', '모든 스킬로 즉시 웨이브를 지운다', 'CS를 전혀 먹지 않고 적만 늘린다', '항상 적 포탑 아래에서 프리징한다'], answer: 0 },
  { text: '【極・マクロ】「Cross-map」の判断として最も典型的なのは？', ko: '【극・매크로】크로스맵 판단의 전형적인 예는?', options: ['敵が片側の大型オブジェクトを取る間に反対側でタワーや別資源を取る', '敵5人の正面へ1人で突っ込む', '全員で同じジャングルキャンプを取る', 'リコールを禁止する'], optionsKo: ['적이 한쪽 대형 오브젝트를 먹는 동안 반대쪽에서 포탑이나 다른 자원을 챙긴다', '적 5명 정면으로 혼자 들어간다', '전원이 같은 정글 캠프를 먹는다', '귀환을 금지한다'], answer: 0 },
  { text: '【極・視界】CamouflageとInvisibilityの違いとして最も近いものは？', ko: '【극・시야】위장(Camouflage)과 투명(Invisibility)의 차이로 가장 가까운 것은?', options: ['Camouflageは敵が十分近づくと看破されやすいが、Invisibilityは近接だけでは通常見えない', 'どちらも完全に同一', 'Invisibilityだけ茂みで解除される', 'Camouflageは味方からも見えない'], optionsKo: ['위장은 적이 충분히 가까이 오면 드러나기 쉽지만, 투명은 단순히 가까이 오는 것만으로는 보통 보이지 않는다', '둘은 완전히 같다', '투명만 수풀에서 해제된다', '위장은 아군에게도 보이지 않는다'], answer: 0 },
  { text: '【極・視界】敵のコントロールワードが通常のステルスワードと違う点として正しいのは？', ko: '【극・시야】적 제어 와드가 일반 투명 와드와 다른 점으로 맞는 것은?', options: ['設置中は通常その姿が見えており、攻撃して破壊できる', '完全に見えず破壊不能', '時間経過で必ず30秒で消える', '視界を一切与えない'], optionsKo: ['설치 중에는 보통 모습이 보이며 공격해서 파괴할 수 있다', '완전히 보이지 않고 파괴 불가', '시간이 지나면 반드시 30초 후 사라진다', '시야를 전혀 제공하지 않는다'], answer: 0 },

  // ===== アイテム・ルーン・計算概念：5問 =====
  { text: '【極・防御計算】敵のArmorに対する効果の適用順として、一般的に割合貫通より先に処理されるものは？', ko: '【극・방어 계산】적 방어력에 대한 효과 적용 순서에서 일반적으로 % 관통보다 먼저 처리되는 것은?', options: ['Armor Reduction（防御力低下）', 'Lethalityだけ', 'クリティカル率', '攻撃速度'], optionsKo: ['방어력 감소', '물리 관통력만', '치명타 확률', '공격 속도'], answer: 0 },
  { text: '【極・アイテム】Spellblade系効果を発動させたあと、実際に追加ダメージを出すために必要な行動は？', ko: '【극・아이템】주문 검 계열 효과를 발동한 뒤 실제 추가 피해를 넣기 위해 필요한 행동은?', options: ['通常攻撃を命中させる', 'リコールする', 'ワードを置く', 'ダメージを受ける'], optionsKo: ['기본 공격을 적중시킨다', '귀환한다', '와드를 설치한다', '피해를 받는다'], answer: 0 },
  { text: '【極・ルーン】First Strikeが発動可能な状態を維持するうえで重要なのは？', ko: '【극・룬】선제공격을 발동 가능한 상태로 유지하는 데 중요한 것은?', options: ['自分が先に敵チャンピオンへ攻撃・スキルを当てること', '必ずHPを50％以下にすること', '敵に先に殴られること', 'ドラゴンを1体倒すこと'], optionsKo: ['자신이 먼저 적 챔피언에게 공격이나 스킬을 맞히는 것', '반드시 HP를 50% 이하로 만드는 것', '적에게 먼저 맞는 것', '드래곤을 1마리 잡는 것'], answer: 0 },
  { text: '【極・ルーン】Presence of Mindの主な役割は？', ko: '【극・룬】침착의 주된 역할은?', options: ['チャンピオンとの戦闘を通じてマナ系リソース維持を助ける', '最大HPを永続的に増やす', '通常攻撃射程を増やす', 'タワーへのダメージだけ増やす'], optionsKo: ['챔피언과의 전투를 통해 마나 계열 자원 유지를 돕는다', '최대 HP를 영구적으로 늘린다', '기본 공격 사거리를 늘린다', '포탑 피해만 늘린다'], answer: 0 },
  { text: '【極・アイテム】Grievous Woundsを重ねて複数人から付与した場合の基本的な考え方は？', ko: '【극・아이템】고통스러운 상처를 여러 명이 동시에 부여했을 때 기본적인 개념은?', options: ['同じ種類の回復阻害率が単純加算され続けるわけではない', '人数分だけ必ず100％まで加算される', '味方の回復まで同時に0になる', '敵の最大HPが永久に減る'], optionsKo: ['같은 종류의 회복 감소율이 인원수만큼 단순 합산되는 것은 아니다', '인원수만큼 반드시 100%까지 더해진다', '아군 회복도 동시에 0이 된다', '적 최대 HP가 영구적으로 줄어든다'], answer: 0 },

  // ===== Worlds・プロ歴史：5問 =====
  { text: '【極・Worlds】2014 World Championship決勝でSamsung Whiteが破った相手は？', ko: '【극・월즈】2014 월드 챔피언십 결승에서 Samsung White가 꺾은 상대는?', options: ['Star Horn Royal Club', 'SK Telecom T1', 'Najin White Shield', 'OMG'], optionsKo: ['Star Horn Royal Club', 'SK Telecom T1', 'Najin White Shield', 'OMG'], answer: 0 },
  { text: '【極・Worlds】2017 World Championship決勝のシリーズスコアは？', ko: '【극・월즈】2017 월드 챔피언십 결승 시리즈 스코어는?', options: ['Samsung Galaxy 3-0 SK Telecom T1', 'Samsung Galaxy 3-2 SK Telecom T1', 'SK Telecom T1 3-1 Samsung Galaxy', 'SK Telecom T1 3-2 Samsung Galaxy'], optionsKo: ['Samsung Galaxy 3-0 SK Telecom T1', 'Samsung Galaxy 3-2 SK Telecom T1', 'SK Telecom T1 3-1 Samsung Galaxy', 'SK Telecom T1 3-2 Samsung Galaxy'], answer: 0 },
  { text: '【極・Worlds】2022 WorldsでDRXが準決勝で破った相手は？', ko: '【극・월즈】2022 월즈에서 DRX가 준결승에서 꺾은 상대는?', options: ['Gen.G', 'EDward Gaming', 'T1', 'JDG'], optionsKo: ['Gen.G', 'EDward Gaming', 'T1', 'JDG'], answer: 0 },
  { text: '【極・Worlds】2018年、韓国開催のWorldsでLPL初の世界優勝を達成したチームは？', ko: '【극・월즈】2018년 한국에서 열린 월즈에서 LPL 최초의 세계 우승을 달성한 팀은?', options: ['Invictus Gaming', 'Royal Never Give Up', 'EDward Gaming', 'FunPlus Phoenix'], optionsKo: ['Invictus Gaming', 'Royal Never Give Up', 'EDward Gaming', 'FunPlus Phoenix'], answer: 0 },
  { text: '【極・Worlds】2023 World Championship決勝でT1が破ったチームは？', ko: '【극・월즈】2023 월드 챔피언십 결승에서 T1이 꺾은 팀은?', options: ['Weibo Gaming', 'Bilibili Gaming', 'JDG', 'Gen.G'], optionsKo: ['Weibo Gaming', 'Bilibili Gaming', 'JDG', 'Gen.G'], answer: 0 },

  // ===== Lore・旧LoL・ゲーム史：5問 =====
  { text: '【極・Lore】パンテオンという「戦いの星霊」に身体を支配されていた人間の名前は？', ko: '【극・로어】판테온이라는 전쟁의 성위에게 몸을 지배당했던 인간의 이름은?', options: ['アトレウス', 'サーン＝ウザル', 'ケガン・ローデ', 'ヴァルマー'], optionsKo: ['아트레우스', '산 우잘', '케간 로디', '발마'], answer: 0 },
  { text: '【極・Lore】シュリーマ帝国で、ゼラスが元々仕えていた皇帝は？', ko: '【극・로어】슈리마 제국에서 제라스가 원래 섬기던 황제는?', options: ['アジール', 'ナサス', 'レネクトン', 'セトラカ'], optionsKo: ['아지르', '나서스', '레넥톤', '세트라카'], answer: 0 },
  { text: '【極・旧LoL】かつて存在したゲームモード「Dominion」の主戦場だったマップは？', ko: '【극・옛 LoL】과거 게임 모드 Dominion의 주 전장이었던 맵은?', options: ['Crystal Scar', 'Twisted Treeline', 'Howling Abyss', 'Magma Chamber'], optionsKo: ['Crystal Scar', 'Twisted Treeline', 'Howling Abyss', 'Magma Chamber'], answer: 0 },
  { text: '【極・旧LoL】かつて存在し、設置型ポータルからVoidspawnを送り出した削除済みアイテムは？', ko: '【극・옛 LoL】과거 존재했고 설치형 포털에서 공허 생물을 내보냈던 삭제 아이템은?', options: ['Zz’Rot Portal', 'Banner of Command', 'Deathfire Grasp', 'Sword of the Occult'], optionsKo: ['Zz’Rot Portal', 'Banner of Command', 'Deathfire Grasp', 'Sword of the Occult'], answer: 0 },
  { text: '【極・旧LoL】かつての3対3専用マップとして最も有名だったものは？', ko: '【극・옛 LoL】과거 3대3 전용 맵으로 가장 유명했던 것은?', options: ['Twisted Treeline', 'Crystal Scar', 'Summoner’s Rift', 'Nexus Blitz'], optionsKo: ['Twisted Treeline', 'Crystal Scar', 'Summoner’s Rift', 'Nexus Blitz'], answer: 0 }
];
