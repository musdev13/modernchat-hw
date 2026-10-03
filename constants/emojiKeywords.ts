import { EMOJI_CATEGORIES } from "@/constants/emoji";

/**
 * Прості ключові слова (укр. + англ.) для пошуку емодзі.
 * Формат рядка: «емодзі слово слово …». Емодзі без запису знаходяться лише
 * за самим символом або за назвою категорії.
 */
const RAW = `
😀 усмішка посмішка радість smile grin happy
😃 усмішка радість весело smile happy
😄 сміх усмішка радість laugh smile
😁 усмішка зуби grin
😆 сміх реготати laugh
😅 піт полегшення нервовий sweat
😂 сміх ржу реготати сльози lol laugh tears joy
🤣 сміх ржу котитись rofl lol
😊 усмішка милий рум'янець blush smile
😇 ангел святий angel halo
🙂 усмішка smile
🙃 догори дриґом upside
😉 підморгнути підморгує wink
😌 спокій полегшення relieved
😍 любов закоханий серце очі love heart eyes
🥰 любов закоханий серця love hearts
😘 поцілунок цілую kiss
😗 поцілунок kiss
😋 смачно ням yum tasty
😛 язик tongue
😜 язик жарт підморгнути tongue wink
🤪 божевільний crazy zany
😝 язик tongue
🤑 гроші money
🤗 обійми hug
🤭 хіхі рот рука oops giggle
🤫 тихо шш секрет quiet shh
🤔 думаю думка хмм think thinking
🤐 мовчи рот zipper
🤨 брова сумнів skeptic
😐 нейтральний neutral
😑 байдужий expressionless
😶 без слів мовчу silent
😏 смішок хитро smirk
😒 незадоволений meh unamused
🙄 очі закотити eyeroll
😬 незручно grimace
🤥 брехня lie
😔 сум сумний sad pensive
😪 сон сонний sleepy
😴 сон спати sleep zzz
😷 маска хворий mask sick
🤒 хворий температура sick fever
🤕 травма bandage hurt
🤢 нудить nausea
🤮 блювота vomit
🤧 чхати sneeze
🥵 спека гарячий hot
🥶 холод cold freeze
🥴 п'яний dizzy woozy
😵 запаморочення dizzy
🤯 вибух мозку shocked mind blown
🤠 ковбой cowboy
🥳 свято вечірка party celebrate
😎 крутий окуляри cool sunglasses
🤓 ботан nerd
🧐 монокль monocle
😕 розгублений confused
😟 тривога worried
🙁 сум frown
☹️ сум frown
😮 вау здивований wow surprised
😯 здивований surprised
😲 шок здивований shocked
😳 збентежений червоний flushed
🥺 прошу благаю милий pleading
😦 здивований frown
😧 переляк anguished
😨 страх fear scared
😰 страх піт anxious
😥 сум розчарований sad
😢 плакати сльоза сум cry sad tear
😭 плакати ридати cry sob
😱 крик жах scream fear
😖 розгублений confounded
😣 мучиться persevere
😞 розчарований sad disappointed
😓 піт sweat
😩 втома tired weary
😫 втомлений tired
🥱 позіхає нудно yawn bored
😤 пихтіти злий huff triumph
😡 злий лють angry mad
😠 злий angry
🤬 лайка злий cursing
😈 диявол devil
👿 диявол злий devil angry
💀 череп смерть skull dead
☠️ череп skull
💩 какашка poop
🤡 клоун clown
👻 привид ghost
👽 прибулець alien
🤖 робот robot
🎃 гелловін гарбуз pumpkin halloween
😺 кіт cat
😸 кіт cat
😹 кіт сміх cat
😻 кіт любов cat love
🙈 мавпа не бачу monkey see
🙉 мавпа не чую monkey hear
🙊 мавпа не кажу monkey speak
❤️ серце любов червоне heart love red
🧡 серце помаранчеве heart orange
💛 серце жовте heart yellow
💚 серце зелене heart green
💙 серце синє heart blue
💜 серце фіолетове heart purple
🖤 серце чорне heart black
🤍 серце біле heart white
🤎 серце коричневе heart brown
💔 розбите серце heart broken
❣️ серце heart
💕 серця любов hearts love
💞 серця hearts
💓 серце пульс heart beat
💗 серце heart
💖 серце блиск heart sparkle
💘 стріла серце cupid arrow heart
💝 серце подарунок gift heart
💯 сто відмінно 100 hundred
💢 злість anger
💥 вибух boom explosion
💫 зірки stars dizzy
💦 краплі вода water drops
💨 біг вітер dash wind
💤 сон zzz sleep
🔥 вогонь гаряче fire hot lit
✨ іскри блиск зірки sparkles magic
⭐ зірка star
🌟 зірка блиск star glow
🎉 свято вечірка конфеті ура party tada celebrate
🎊 свято конфеті confetti
🎈 куля шарик balloon
🎁 подарунок gift present
🎂 торт день народження cake birthday
🍰 торт cake
🏆 кубок перемога trophy win
🥇 перше місце медаль gold medal
🎯 ціль dart target
🎮 гра ігри game controller
🎵 музика нота music note
🎶 музика ноти music notes
🎤 мікрофон microphone
🎧 навушники headphones
👍 так добре клас лайк підтримка thumbs up like yes ok
👎 ні погано дизлайк thumbs down dislike no
👌 окей добре ok okay
✌️ мир перемога peace victory
🤞 удача fingers crossed luck
🤟 люблю love you
🤘 рок rock
🤙 дзвони call me
👈 вказує ліворуч left
👉 вказує праворуч right
👆 вгору up
👇 вниз down
☝️ вгору один up one
✋ стоп рука stop hand
🖐️ рука hand
🖖 вулкан vulcan
👋 привіт махати hi hello wave bye
🤚 рука hand
👏 оплески браво clap applause
🙌 ура руки hooray hands
👐 відкриті руки open hands
🤲 долоні palms
🤝 рукостискання угода handshake deal
🙏 дякую прошу молитва please thanks pray
✍️ писати write
💪 сила м'язи strong muscle
🦾 протез сила robot arm
👀 очі дивлюсь eyes look
👁️ око eye
👅 язик tongue
👄 губи lips
🧠 мозок brain
🫶 серце руки heart hands
🫡 салют salute
🫠 тане melting
🥹 зворушений teary
🐶 собака пес dog
🐱 кіт кішка cat
🐭 миша mouse
🐹 хом'як hamster
🐰 кролик rabbit
🦊 лис fox
🐻 ведмідь bear
🐼 панда panda
🐨 коала koala
🐯 тигр tiger
🦁 лев lion
🐮 корова cow
🐷 свиня pig
🐸 жаба frog
🐵 мавпа monkey
🐔 курка chicken
🐧 пінгвін penguin
🐦 птах bird
🦆 качка duck
🦅 орел eagle
🦉 сова owl
🐴 кінь horse
🦄 єдиноріг unicorn
🐝 бджола bee
🦋 метелик butterfly
🐌 равлик snail
🐞 сонечко ladybug
🐢 черепаха turtle
🐍 змія snake
🐙 восьминіг octopus
🐠 риба fish
🐬 дельфін dolphin
🐳 кит whale
🦈 акула shark
🌹 троянда rose
🌷 тюльпан tulip
🌻 соняшник sunflower
🌸 квітка сакура flower blossom
🌼 квітка flower
🍀 конюшина удача clover luck
🌲 ялина дерево tree
🌳 дерево tree
🌴 пальма palm
🌵 кактус cactus
🍁 листя осінь leaf maple
☀️ сонце sun
🌙 місяць moon
🌈 веселка rainbow
☁️ хмара cloud
⛈️ гроза storm
❄️ сніг сніжинка snow
⛄ сніговик snowman
💧 крапля вода drop water
🌊 хвиля wave
🍎 яблуко apple
🍌 банан banana
🍉 кавун watermelon
🍇 виноград grapes
🍓 полуниця strawberry
🍒 вишня cherry
🍑 персик peach
🍍 ананас pineapple
🥑 авокадо avocado
🍅 помідор tomato
🥕 морква carrot
🌽 кукурудза corn
🍔 бургер burger
🍟 картопля фрі fries
🍕 піца pizza
🌭 хот-дог hotdog
🥪 сендвіч sandwich
🌮 тако taco
🍝 паста спагеті pasta
🍜 локшина noodles
🍣 суші sushi
🍩 пончик donut
🍪 печиво cookie
🍫 шоколад chocolate
🍬 цукерка candy
🍦 морозиво ice cream
🍺 пиво beer
🍻 пиво cheers beer
🍷 вино wine
🥂 шампанське cheers champagne
🍸 коктейль cocktail
☕ кава coffee
🍵 чай tea
🥤 напій drink
⚽ футбол football soccer
🏀 баскетбол basketball
🏈 футбол american football
🎾 теніс tennis
🏐 волейбол volleyball
🏓 пінг-понг ping pong
🥊 бокс boxing
🚗 авто машина car
🚕 таксі taxi
🚌 автобус bus
🚓 поліція police
🚑 швидка ambulance
🚒 пожежна fire truck
🚲 велосипед bicycle
🏍️ мотоцикл motorcycle
✈️ літак plane
🚀 ракета rocket
🚁 гелікоптер helicopter
⛵ яхта парусник boat
🚢 корабель ship
🏠 дім будинок house home
🏢 офіс office
🏖️ пляж beach
⌚ годинник watch
📱 телефон phone
💻 ноутбук laptop
⌨️ клавіатура keyboard
🖥️ комп'ютер computer
📷 камера фото camera
📹 відео video
🎥 кіно movie camera
📺 телевізор tv
📞 телефон дзвінок phone call
🔋 батарея battery
💡 ідея лампочка idea bulb
💰 гроші money bag
💵 гроші долари dollar money
💳 картка card
💎 діамант diamond
🔑 ключ key
🔒 замок lock
🔔 дзвоник сповіщення bell
📌 кнопка pin
📎 скріпка clip
✏️ олівець pencil
📚 книги books
📖 книга book
📝 нотатка note memo
📅 календар calendar
💼 портфель briefcase
🧳 валіза luggage
⚠️ увага warning
🚫 заборона no prohibited
✅ готово галочка check done
❌ хрест ні cross no
❓ питання question
❗ оклик увага exclamation
💬 повідомлення чат chat message
💭 думка thought
🔴 червоне коло red circle
🟢 зелене коло green circle
🔵 синє коло blue circle
➕ плюс plus
➖ мінус minus
➡️ праворуч стрілка right arrow
⬅️ ліворуч стрілка left arrow
⬆️ вгору стрілка up arrow
⬇️ вниз стрілка down arrow
🔄 оновити refresh
🇺🇦 україна прапор ukraine flag
🏳️‍🌈 веселка прапор rainbow flag
🏴‍☠️ піратський прапор pirate flag
`;

function normalize(s: string): string {
  return s.replace(/\uFE0F/g, "");
}

const KEYWORDS = new Map<string, string>();
for (const line of RAW.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  const space = trimmed.indexOf(" ");
  if (space < 0) continue;
  KEYWORDS.set(
    normalize(trimmed.slice(0, space)),
    trimmed.slice(space + 1).toLowerCase(),
  );
}

let allCache: string[] | null = null;
function allEmojis(): string[] {
  if (!allCache) {
    const seen = new Set<string>();
    for (const cat of EMOJI_CATEGORIES) {
      for (const e of cat.emojis) seen.add(e);
    }
    allCache = [...seen];
  }
  return allCache;
}

/** Пошук емодзі за словом (укр./англ.), за назвою категорії або за самим символом. */
export function searchEmojis(rawQuery: string): string[] {
  const q = normalize(rawQuery.trim().toLowerCase());
  if (!q) return [];

  const result: string[] = [];
  const seen = new Set<string>();
  const push = (e: string) => {
    if (!seen.has(e)) {
      seen.add(e);
      result.push(e);
    }
  };

  // 1) точний символ
  for (const e of allEmojis()) {
    if (normalize(e) === q) push(e);
  }
  // 2) слово на початку ключових слів — вище, ніж «містить»
  const terms = q.split(/\s+/).filter(Boolean);
  const matchStart: string[] = [];
  const matchAny: string[] = [];
  for (const e of allEmojis()) {
    const kw = KEYWORDS.get(normalize(e));
    if (!kw) continue;
    const words = kw.split(" ");
    const startsAll = terms.every((t) => words.some((w) => w.startsWith(t)));
    if (startsAll) {
      matchStart.push(e);
      continue;
    }
    if (terms.every((t) => kw.includes(t))) matchAny.push(e);
  }
  matchStart.forEach(push);
  matchAny.forEach(push);

  // 3) назва категорії
  for (const cat of EMOJI_CATEGORIES) {
    if (cat.label.toLowerCase().includes(q)) cat.emojis.forEach(push);
  }

  return result;
}
