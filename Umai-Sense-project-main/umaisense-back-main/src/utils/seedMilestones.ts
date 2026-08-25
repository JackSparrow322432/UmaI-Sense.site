import { Milestone } from '../models/Milestone';

type Direction = 'cognitive' | 'motor' | 'social' | 'speech' | 'selfcare';

interface SeedItem {
  ageGroup: string;
  direction: Direction;
  skill: string;
  description?: string;
}

const MILESTONES: SeedItem[] = [
  // ─── COGNITIVE ──────────────────────────────────────────────────────────────
  { ageGroup: '2-3', direction: 'cognitive', skill: 'Сортирует предметы по цвету', description: 'Раскладывает предметы в группы по цвету без подсказки' },
  { ageGroup: '2-3', direction: 'cognitive', skill: 'Находит спрятанный предмет', description: 'Помнит, куда убрали игрушку, и идёт за ней' },
  { ageGroup: '2-3', direction: 'cognitive', skill: 'Показывает на картинки по названию', description: 'Указывает на знакомые предметы в книжке, когда их называют' },
  { ageGroup: '2-3', direction: 'cognitive', skill: 'Повторяет простые действия', description: 'Копирует действия взрослого: стучит, хлопает, машет' },

  { ageGroup: '3-4', direction: 'cognitive', skill: 'Знает своё полное имя', description: 'Называет имя и фамилию при вопросе «Как тебя зовут?»' },
  { ageGroup: '3-4', direction: 'cognitive', skill: 'Считает до 5', description: 'Пересчитывает предметы до пяти, указывая на каждый' },
  { ageGroup: '3-4', direction: 'cognitive', skill: 'Понимает «большой» и «маленький»', description: 'Выбирает нужный предмет по размеру по просьбе' },
  { ageGroup: '3-4', direction: 'cognitive', skill: 'Складывает пазл из 4 частей', description: 'Самостоятельно собирает простой пазл' },

  { ageGroup: '4-5', direction: 'cognitive', skill: 'Называет основные цвета', description: 'Правильно называет не менее 4 цветов' },
  { ageGroup: '4-5', direction: 'cognitive', skill: 'Считает до 10', description: 'Считает вслух до десяти и понимает количество' },
  { ageGroup: '4-5', direction: 'cognitive', skill: 'Понимает «вчера» и «сегодня»', description: 'Может объяснить, что было вчера и что происходит сегодня' },
  { ageGroup: '4-5', direction: 'cognitive', skill: 'Складывает пазл из 8–12 частей', description: 'Собирает пазл с изображением самостоятельно' },

  { ageGroup: '5-6', direction: 'cognitive', skill: 'Называет дни недели по порядку', description: 'Перечисляет дни недели и понимает их очерёдность' },
  { ageGroup: '5-6', direction: 'cognitive', skill: 'Понимает причину и следствие', description: 'Объясняет, почему что-то произошло: «упал, потому что...»' },
  { ageGroup: '5-6', direction: 'cognitive', skill: 'Распознаёт буквы алфавита', description: 'Называет знакомые буквы в словах или на карточках' },
  { ageGroup: '5-6', direction: 'cognitive', skill: 'Решает задачи сложения до 5', description: 'Считает предметы и определяет итог сложения' },

  { ageGroup: '6-7', direction: 'cognitive', skill: 'Читает простые слова', description: 'Складывает и читает слова из 3–4 букв' },
  { ageGroup: '6-7', direction: 'cognitive', skill: 'Считает до 20', description: 'Считает и записывает числа до двадцати' },
  { ageGroup: '6-7', direction: 'cognitive', skill: 'Сравнивает числа', description: 'Понимает «больше» и «меньше» при сравнении двух чисел' },
  { ageGroup: '6-7', direction: 'cognitive', skill: 'Выполняет задание из 3 шагов', description: 'Понимает и последовательно выполняет инструкцию из трёх частей' },

  { ageGroup: '7-8', direction: 'cognitive', skill: 'Читает короткие тексты', description: 'Читает и понимает смысл небольшого абзаца' },
  { ageGroup: '7-8', direction: 'cognitive', skill: 'Понимает время по часам', description: 'Называет время с точностью до получаса' },
  { ageGroup: '7-8', direction: 'cognitive', skill: 'Решает задачи на вычитание', description: 'Выполняет простые примеры на вычитание в пределах 10' },
  { ageGroup: '7-8', direction: 'cognitive', skill: 'Планирует свои действия', description: 'Может объяснить последовательность действий для выполнения задачи' },

  // ─── MOTOR ──────────────────────────────────────────────────────────────────
  { ageGroup: '2-3', direction: 'motor', skill: 'Бросает мяч двумя руками', description: 'Бросает мяч взрослому на расстоянии 1–2 метра' },
  { ageGroup: '2-3', direction: 'motor', skill: 'Поднимается по лестнице с поддержкой', description: 'Идёт по ступенькам, держась за перила или руку' },
  { ageGroup: '2-3', direction: 'motor', skill: 'Рисует каракули', description: 'Держит карандаш и оставляет линии на бумаге' },
  { ageGroup: '2-3', direction: 'motor', skill: 'Ест ложкой самостоятельно', description: 'Доносит ложку до рта с минимальным рассыпанием' },

  { ageGroup: '3-4', direction: 'motor', skill: 'Прыгает на двух ногах', description: 'Прыгает на месте и с продвижением вперёд' },
  { ageGroup: '3-4', direction: 'motor', skill: 'Держит карандаш правильно', description: 'Удерживает карандаш щипковым захватом' },
  { ageGroup: '3-4', direction: 'motor', skill: 'Строит башню из 6 кубиков', description: 'Аккуратно ставит кубики друг на друга без падения' },
  { ageGroup: '3-4', direction: 'motor', skill: 'Расстёгивает крупные пуговицы', description: 'Самостоятельно расстёгивает большие пуговицы на одежде' },

  { ageGroup: '4-5', direction: 'motor', skill: 'Прыгает на одной ноге', description: 'Прыгает минимум 5 раз на одной ноге' },
  { ageGroup: '4-5', direction: 'motor', skill: 'Вырезает по прямой линии', description: 'Режет бумагу ножницами, следуя прямой линии' },
  { ageGroup: '4-5', direction: 'motor', skill: 'Рисует круг и квадрат', description: 'Копирует простые геометрические фигуры' },
  { ageGroup: '4-5', direction: 'motor', skill: 'Ловит мяч двумя руками', description: 'Ловит мяч среднего размера, брошенный с расстояния 1,5 м' },

  { ageGroup: '5-6', direction: 'motor', skill: 'Пишет своё имя', description: 'Самостоятельно пишет имя печатными буквами' },
  { ageGroup: '5-6', direction: 'motor', skill: 'Вырезает по контуру', description: 'Вырезает простую фигуру, следуя нарисованному контуру' },
  { ageGroup: '5-6', direction: 'motor', skill: 'Завязывает шнурки с помощью', description: 'Завязывает узел и петлю при небольшой помощи взрослого' },
  { ageGroup: '5-6', direction: 'motor', skill: 'Прыгает через скакалку', description: 'Перепрыгивает через неподвижную скакалку на земле' },

  { ageGroup: '6-7', direction: 'motor', skill: 'Завязывает шнурки самостоятельно', description: 'Самостоятельно завязывает шнурки двойным узлом' },
  { ageGroup: '6-7', direction: 'motor', skill: 'Пишет буквы и цифры', description: 'Пишет разборчиво, соблюдая строку и размер' },
  { ageGroup: '6-7', direction: 'motor', skill: 'Бросает и ловит мяч точно', description: 'Целенаправленно бросает и ловит мяч с партнёром' },
  { ageGroup: '6-7', direction: 'motor', skill: 'Катается на велосипеде', description: 'Едет на двухколёсном велосипеде или самокате' },

  { ageGroup: '7-8', direction: 'motor', skill: 'Пишет разборчиво и быстро', description: 'Записывает предложения разборчивым почерком за разумное время' },
  { ageGroup: '7-8', direction: 'motor', skill: 'Участвует в подвижных играх', description: 'Выполняет правила игр с движением в группе' },
  { ageGroup: '7-8', direction: 'motor', skill: 'Выполняет точные движения', description: 'Нанизывает бусины, складывает оригами, работает с мелкими деталями' },
  { ageGroup: '7-8', direction: 'motor', skill: 'Координирует движения рук и глаз', description: 'Попадает мячом в цель, вырезает сложные формы' },

  // ─── SOCIAL ─────────────────────────────────────────────────────────────────
  { ageGroup: '2-3', direction: 'social', skill: 'Реагирует на своё имя', description: 'Поворачивается или откликается, когда его называют по имени' },
  { ageGroup: '2-3', direction: 'social', skill: 'Играет рядом с другими детьми', description: 'Находится рядом с другим ребёнком и занимается своим делом' },
  { ageGroup: '2-3', direction: 'social', skill: 'Машет рукой «пока»', description: 'Прощается жестом или словом при расставании' },
  { ageGroup: '2-3', direction: 'social', skill: 'Проявляет привязанность', description: 'Обнимает или тянется к знакомым людям' },

  { ageGroup: '3-4', direction: 'social', skill: 'Делится игрушками по просьбе', description: 'Даёт свою вещь другому ребёнку, когда попросят' },
  { ageGroup: '3-4', direction: 'social', skill: 'Ждёт своей очереди', description: 'Соблюдает очерёдность в простой игре без напоминания' },
  { ageGroup: '3-4', direction: 'social', skill: 'Проявляет интерес к сверстникам', description: 'Наблюдает за другими детьми и подходит к ним' },
  { ageGroup: '3-4', direction: 'social', skill: 'Участвует в групповой игре', description: 'Присоединяется к игре с 1–2 другими детьми' },

  { ageGroup: '4-5', direction: 'social', skill: 'Играет совместно', description: 'Участвует в сюжетной игре вместе с другими детьми' },
  { ageGroup: '4-5', direction: 'social', skill: 'Называет базовые эмоции', description: 'Правильно называет «радость», «грусть», «злость», «страх»' },
  { ageGroup: '4-5', direction: 'social', skill: 'Следует правилам игры', description: 'Играет по простым правилам без постоянного напоминания' },
  { ageGroup: '4-5', direction: 'social', skill: 'Имеет предпочитаемого друга', description: 'Называет и ищет конкретного ребёнка для игры' },

  { ageGroup: '5-6', direction: 'social', skill: 'Сопереживает другим', description: 'Утешает расстроенного ребёнка или взрослого' },
  { ageGroup: '5-6', direction: 'social', skill: 'Разрешает конфликты словами', description: 'Говорит «не надо так» или «давай по-другому» вместо драки' },
  { ageGroup: '5-6', direction: 'social', skill: 'Участвует в ролевых играх', description: 'Принимает роль и удерживает её в ходе игры' },
  { ageGroup: '5-6', direction: 'social', skill: 'Понимает чувства других', description: 'Говорит, почему другой человек грустит или радуется' },

  { ageGroup: '6-7', direction: 'social', skill: 'Работает в команде', description: 'Выполняет общее задание вместе с другими детьми' },
  { ageGroup: '6-7', direction: 'social', skill: 'Поддерживает дружбу', description: 'Помнит о друге, скучает и рад встрече' },
  { ageGroup: '6-7', direction: 'social', skill: 'Знает как попросить о помощи', description: 'Обращается к взрослому или сверстнику с просьбой о помощи' },
  { ageGroup: '6-7', direction: 'social', skill: 'Понимает социальные правила', description: 'Знает нормы поведения в общественных местах и следует им' },

  { ageGroup: '7-8', direction: 'social', skill: 'Адаптируется в новой группе', description: 'Вливается в новый коллектив в течение нескольких дней' },
  { ageGroup: '7-8', direction: 'social', skill: 'Проявляет эмпатию', description: 'Учитывает чувства другого человека в своих действиях' },
  { ageGroup: '7-8', direction: 'social', skill: 'Решает конфликты самостоятельно', description: 'Находит компромисс без участия взрослого' },
  { ageGroup: '7-8', direction: 'social', skill: 'Имеет стабильные дружеские отношения', description: 'Поддерживает дружбу со сверстниками на протяжении нескольких месяцев' },

  // ─── SPEECH ─────────────────────────────────────────────────────────────────
  { ageGroup: '2-3', direction: 'speech', skill: 'Использует 50+ слов', description: 'Активный словарный запас — не менее пятидесяти слов' },
  { ageGroup: '2-3', direction: 'speech', skill: 'Составляет фразы из 2 слов', description: 'Говорит «дай мяч», «мама пришла», «хочу есть»' },
  { ageGroup: '2-3', direction: 'speech', skill: 'Называет предметы на картинке', description: 'Указывает и называет знакомые объекты в книжке' },
  { ageGroup: '2-3', direction: 'speech', skill: 'Понимает простые инструкции', description: 'Выполняет команды из одного действия: «дай», «иди», «сядь»' },

  { ageGroup: '3-4', direction: 'speech', skill: 'Составляет предложения из 3–4 слов', description: 'Строит короткие фразы с подлежащим и сказуемым' },
  { ageGroup: '3-4', direction: 'speech', skill: 'Задаёт вопросы «что?» и «где?»', description: 'Самостоятельно спрашивает, не просто повторяет за взрослым' },
  { ageGroup: '3-4', direction: 'speech', skill: 'Называет части тела', description: 'Показывает и называет не менее 10 частей тела' },
  { ageGroup: '3-4', direction: 'speech', skill: 'Рассказывает о событиях', description: 'Сообщает, что произошло: «я упал», «мы ходили в парк»' },

  { ageGroup: '4-5', direction: 'speech', skill: 'Задаёт вопрос «почему?»', description: 'Спрашивает о причинах происходящего' },
  { ageGroup: '4-5', direction: 'speech', skill: 'Использует прошедшее время', description: 'Правильно говорит «я ел», «мы пошли», «она упала»' },
  { ageGroup: '4-5', direction: 'speech', skill: 'Рассказывает короткую историю', description: 'Пересказывает знакомую сказку или событие из 3–4 предложений' },
  { ageGroup: '4-5', direction: 'speech', skill: 'Понимает двухшаговую инструкцию', description: 'Выполняет «возьми книгу и положи на стол» без повтора' },

  { ageGroup: '5-6', direction: 'speech', skill: 'Рассказывает о прошедших событиях', description: 'Описывает что делал вчера или на прошлой неделе' },
  { ageGroup: '5-6', direction: 'speech', skill: 'Использует сложные предложения', description: 'Говорит с союзами «потому что», «чтобы», «когда»' },
  { ageGroup: '5-6', direction: 'speech', skill: 'Объясняет назначение предметов', description: 'Говорит «ложкой едят», «ножом режут»' },
  { ageGroup: '5-6', direction: 'speech', skill: 'Понимает простые абстрактные понятия', description: 'Знает значения слов «дружба», «честность», «опасность»' },

  { ageGroup: '6-7', direction: 'speech', skill: 'Ведёт диалог', description: 'Поддерживает разговор: слушает, отвечает по теме, задаёт вопросы' },
  { ageGroup: '6-7', direction: 'speech', skill: 'Объясняет свои действия', description: 'Может рассказать, что и почему делает' },
  { ageGroup: '6-7', direction: 'speech', skill: 'Использует связный монолог', description: 'Рассказывает историю или описывает картинку из 5–7 предложений' },
  { ageGroup: '6-7', direction: 'speech', skill: 'Понимает переносный смысл', description: 'Понимает простые идиомы: «льёт как из ведра», «золотые руки»' },

  { ageGroup: '7-8', direction: 'speech', skill: 'Читает вслух с выражением', description: 'Читает текст с паузами и интонацией по смыслу' },
  { ageGroup: '7-8', direction: 'speech', skill: 'Пересказывает прочитанный текст', description: 'Передаёт главную мысль и детали прочитанного' },
  { ageGroup: '7-8', direction: 'speech', skill: 'Использует развёрнутую речь', description: 'Говорит полными предложениями с развёрнутыми объяснениями' },
  { ageGroup: '7-8', direction: 'speech', skill: 'Пишет простые предложения', description: 'Записывает предложения из 5–7 слов с базовыми знаками препинания' },

  // ─── SELFCARE ────────────────────────────────────────────────────────────────
  { ageGroup: '2-3', direction: 'selfcare', skill: 'Пьёт из кружки самостоятельно', description: 'Берёт кружку двумя руками и пьёт без помощи' },
  { ageGroup: '2-3', direction: 'selfcare', skill: 'Ест ложкой и вилкой', description: 'Самостоятельно ест, практически не рассыпая' },
  { ageGroup: '2-3', direction: 'selfcare', skill: 'Помогает одеваться', description: 'Поднимает ноги при надевании штанов, вставляет руки в рукава' },
  { ageGroup: '2-3', direction: 'selfcare', skill: 'Моет руки с помощью', description: 'Трёт руки с мылом при помощи взрослого' },

  { ageGroup: '3-4', direction: 'selfcare', skill: 'Одевается с минимальной помощью', description: 'Надевает большинство одежды самостоятельно, затрудняется с пуговицами' },
  { ageGroup: '3-4', direction: 'selfcare', skill: 'Пользуется туалетом самостоятельно', description: 'Сообщает о потребности, идёт в туалет без напоминания' },
  { ageGroup: '3-4', direction: 'selfcare', skill: 'Чистит зубы с помощью', description: 'Чистит зубы сам, взрослый проверяет и дочищает' },
  { ageGroup: '3-4', direction: 'selfcare', skill: 'Убирает игрушки', description: 'Складывает игрушки на место после напоминания' },

  { ageGroup: '4-5', direction: 'selfcare', skill: 'Одевается полностью самостоятельно', description: 'Надевает всю одежду сам, кроме завязывания шнурков' },
  { ageGroup: '4-5', direction: 'selfcare', skill: 'Застёгивает молнию', description: 'Самостоятельно застёгивает и расстёгивает молнию на куртке' },
  { ageGroup: '4-5', direction: 'selfcare', skill: 'Моет руки самостоятельно', description: 'Открывает кран, моет руки с мылом и вытирает без напоминания' },
  { ageGroup: '4-5', direction: 'selfcare', skill: 'Помогает накрыть на стол', description: 'Раскладывает приборы или ставит тарелки по просьбе' },

  { ageGroup: '5-6', direction: 'selfcare', skill: 'Чистит зубы самостоятельно', description: 'Чистит зубы утром и вечером без напоминания взрослого' },
  { ageGroup: '5-6', direction: 'selfcare', skill: 'Убирает за собой посуду', description: 'Относит тарелку и кружку после еды без просьбы' },
  { ageGroup: '5-6', direction: 'selfcare', skill: 'Причёсывается', description: 'Расчёсывает волосы самостоятельно' },
  { ageGroup: '5-6', direction: 'selfcare', skill: 'Застёгивает пуговицы', description: 'Самостоятельно застёгивает пуговицы на одежде' },

  { ageGroup: '6-7', direction: 'selfcare', skill: 'Следит за личной гигиеной', description: 'Самостоятельно умывается, чистит зубы, причёсывается каждый день' },
  { ageGroup: '6-7', direction: 'selfcare', skill: 'Самостоятельно собирает вещи', description: 'Складывает рюкзак или сумку по списку или памяти' },
  { ageGroup: '6-7', direction: 'selfcare', skill: 'Убирает в своей комнате', description: 'Складывает вещи на место и застилает кровать с помощью' },
  { ageGroup: '6-7', direction: 'selfcare', skill: 'Помогает готовить простую еду', description: 'Намазывает масло, наливает напиток, моет фрукты' },

  { ageGroup: '7-8', direction: 'selfcare', skill: 'Полная самостоятельность в гигиене', description: 'Выполняет все процедуры ежедневной гигиены без напоминаний' },
  { ageGroup: '7-8', direction: 'selfcare', skill: 'Выполняет домашние обязанности', description: 'Регулярно выполняет несложные домашние дела: вынести мусор, полить цветы' },
  { ageGroup: '7-8', direction: 'selfcare', skill: 'Управляет своим временем', description: 'Понимает расписание дня и самостоятельно переходит к следующей задаче' },
  { ageGroup: '7-8', direction: 'selfcare', skill: 'Полностью одевается и собирается', description: 'Готовится к выходу из дома без помощи взрослого' },
];

export const seedMilestones = async (): Promise<void> => {
  const count = await Milestone.countDocuments();
  if (count > 0) return; // already seeded

  await Milestone.insertMany(MILESTONES);
  console.log(`[Seed] Inserted ${MILESTONES.length} milestones`);
};
