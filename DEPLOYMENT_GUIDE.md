# Инструкции по развертыванию (Deployment Guide)

В этой инструкции описано, как перенести проект "Генератор Расписания" из режима разработки в рабочий режим (Production).

---

## Вариант А: Развертывание на VPS (Ubuntu 22.04+)

### 1. Подготовка сервера
Подключитесь к вашему серверу по SSH и выполните команды:
```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установка Docker Compose
sudo apt install docker-compose-plugin -y
```

### 2. Копирование проекта
Вы можете склонировать проект через Git или загрузить его архивом.
```bash
git clone https://github.com/your-repo/schedule-generator.git
cd schedule-generator
```

### 3. Настройка окружения
Создайте файл `.env` на сервере:
```bash
cp backend/.env .env
# Обязательно замените пароли на сложные!
nano .env
```
Убедитесь, что в `.env` указаны:
- `DB_PASSWORD`
- `JWT_SECRET` (произвольная длинная строка)
- `ADMIN_PASSWORD` (пароль для входа в систему)

### 4. Запуск
Используйте созданный файл `docker-compose.prod.yml`:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Вариант Б: Хостинг на своем ПК через Cloudflare Tunnel

Этот вариант позволяет сделать сайт доступным в интернете без аренды сервера.

### 1. Запуск проекта локально
1. Убедитесь, что у вас установлен Docker Desktop.
2. В папке проекта выполните:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```
3. Проверьте, что сайт открывается по адресу `http://localhost:80`.

### 2. Настройка Cloudflare
1. У вас должен быть аккаунт на [Cloudflare](https://dash.cloudflare.com/) и привязанный домен.
2. Перейдите в **Zero Trust** -> **Networks** -> **Tunnels**.
3. Нажмите **Create a tunnel**, выберите имя.
4. Выберите **Install connector** для Windows (скачайте `cloudflared.exe`, если его еще нет, и выполните команду установки службы, которую даст сайт).
5. В вкладке **Public Hostname**:
   - **Subdomain**: например, `schedule`
   - **Domain**: выберите ваш домен
   - **Service Type**: `HTTP`
   - **URL**: `localhost:80`
6. Нажмите **Save tunnel**. Теперь ваш проект доступен по адресу `https://schedule.yourdomain.com`.

---

## Проверка работоспособности
После запуска любым способом проверьте:
1. **API**: Откройте в браузере `http://ваш-ip-или-домен/api/health`. Должно вернуться `{"status":"ok"}`.
2. **Frontend**: Основная страница сайта должна загружаться и не показывать ошибок подключения к API.
3. **БД**: Попробуйте войти в систему под администратором (ИИН: `990101000001`, пароль из `.env`).
