# Modern Chat

Modern Chat — сучасний мобільний застосунок для обміну повідомленнями, створений на базі **React Native + Expo** з використанням **Expo Router**, **Convex** та **Convex Auth**.

## Технологічний стек

* **React Native**
* **Expo**
* **Expo Router**
* **TypeScript**
* **NativeWind / Tailwind CSS**
* **Convex**
* **Convex Auth**
* **Expo Secure Store**
* **React Native Gesture Handler**
* **EAS**

## Можливості

* Реєстрація та авторизація користувачів
* Створення та видалення чатів
* Надсилання текстових повідомлень
* Редагування та видалення повідомлень
* Відповіді на повідомлення
* Індикатор набору тексту
* Swipe-жести
* Надсилання зображень
* Аватар користувача
* Редагування профілю
* Перегляд публічного профілю користувача
* Зберігання файлів через Convex Storage
* Захищене зберігання токенів через Expo Secure Store

## Структура проєкту

```text
modernchat/
├── app/
│   ├── (auth)/
│   ├── (tabs)/
│   ├── chat/
│   ├── profile/
│   ├── settings/
│   ├── user/
│   └── _layout.tsx
├── components/
├── convex/
│   ├── auth.ts
│   ├── schema.ts
│   ├── users.ts
│   └── ...
├── constants/
├── assets/
├── app.config.ts
├── eas.json
├── package.json
└── README.md
```

## Середовища

Проєкт використовує три середовища EAS:

* `development`
* `preview`
* `production`

Конфігурація застосунку визначається за допомогою змінної `APP_ENV`.

### Development

Ідентифікатор застосунку:

```text
com.musdev13.modernchat.dev
```

Назва застосунку:

```text
Modern Chat Dev
```

Scheme:

```text
modernchat-dev
```

### Preview

Ідентифікатор застосунку:

```text
com.musdev13.modernchat.preview
```

Назва:

```text
Modern Chat Preview
```

Scheme:

```text
modernchat-preview
```

### Production

Основний ідентифікатор:

```text
com.musdev13.modernchat
```

Назва:

```text
Modern Chat
```

Scheme:

```text
modernchat
```

## Змінні середовища

Основна змінна:

```text
EXPO_PUBLIC_CONVEX_URL
```

Вона налаштована в EAS для всіх трьох середовищ.

Production Convex deployment:

```text
https://brave-woodpecker-411.convex.cloud
```

Локальна розробка використовує окремий development deployment Convex.

> Секретні та локальні змінні середовища не повинні додаватися до Git.

## EAS

Конфігурація збірок знаходиться у файлі `eas.json`.

Доступні профілі:

```text
development
preview
production
```

Preview-профіль налаштований для створення Android APK.

Production використовує автоматичне збільшення версії застосунку.

## Convex

Backend реалізований за допомогою Convex.

Production deployment:

```text
brave-woodpecker-411
```

Production deployment було успішно виконано разом із застосуванням схеми бази даних, функцій та індексів Convex.

Для production-деплою використовується:

```bash
npx convex deploy
```

Для локальної розробки:

```bash
npx convex dev
```

## Запуск проєкту

Встановлення залежностей:

```bash
npm install
```

Запуск Expo:

```bash
npx expo start
```

Для локальної розробки backend:

```bash
npx convex dev
```

## Конфігурація застосунку

Динамічна конфігурація Expo знаходиться у файлі:

```text
app.config.ts
```

Конфігурація автоматично вибирається залежно від значення:

```text
APP_ENV
```

Доступні значення:

```text
development
preview
production
```

## EAS Project

Expo/EAS проєкт:

```text
@musdev13/modernchat
```

EAS Project ID:

```text
53ed0c51-a88c-4f35-89cc-a49c1f88bc88
```

## Іконки

Для різних середовищ використовуються окремі іконки:

```text
assets/images/icons/
├── icon-dev.png
├── icon-preview.png
├── android-icon-foreground-dev.png
└── android-icon-foreground-preview.png
```

Production використовує основні іконки застосунку.

## Безпека

* Токени авторизації зберігаються за допомогою `expo-secure-store`.
* Production URL Convex налаштовується через змінні середовища.
* Файли користувачів зберігаються через Convex Storage.
* `.env.local` використовується для локальної розробки та не повинен потрапляти до Git.

## Статус

* [x] Expo / EAS Project
* [x] Динамічний `app.config.ts`
* [x] Development environment
* [x] Preview environment
* [x] Production environment
* [x] EAS build profiles
* [x] Змінні середовища EAS
* [x] Окремі іконки для середовищ
* [x] Production Convex deployment
* [x] Авторизація
* [x] Чати
* [x] Повідомлення
* [x] Відповіді на повідомлення
* [x] Редагування та видалення повідомлень
* [x] Профілі користувачів
* [x] Завантаження аватарів
* [x] Convex Storage
* [x] Gesture interactions
