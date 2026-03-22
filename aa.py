import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import WebAppInfo
import uvicorn

# --- CONFIG ---
API_TOKEN = '8563576387:AAH-nQspEDnjDmPBUprAv4Cnpx93xsSF-rU'
WEB_APP_URL = "https://prazazz.duckdns.org" # VPS එකට point කළ domain එක

bot = Bot(token=API_TOKEN)
dp = Dispatcher()
app = FastAPI()

# --- 1. WEB APP FRONTEND (HTML) ---
# මෙම කොටසින් වෙබ් ඇප් එකේ පෙනුම තීරණය වේ
@app.get("/", response_class=HTMLResponse)
async def get_webapp():
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>BOOSTME LANKA</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <style>
            body {{ font-family: sans-serif; background: #1a1a1a; color: white; text-align: center; padding: 50px; }}
            .card {{ background: #2c2c2c; padding: 20px; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }}
            .btn {{ background: #f39c12; color: white; border: none; padding: 15px 30px; border-radius: 10px; font-weight: bold; cursor: pointer; }}
            h1 {{ color: #f39c12; }}
        </style>
    </head>
    <body>
        <div class="card">
            <h1>🚀 BOOSTME LANKA</h1>
            <p>ඔබේ Point ප්‍රමාණය: <span id="user_pts">10</span></p>
            <button class="btn" onclick="tg.close()">වැඩේ අවසන් කරන්න</button>
        </div>
        <script>
            let tg = window.Telegram.WebApp;
            tg.expand(); // App එක සම්පූර්ණයෙන් විවෘත කරන්න
        </script>
    </body>
    </html>
    """

# --- 2. BOT LOGIC ---
@dp.message(Command("start"))
async def start_cmd(message: types.Message):
    # WebAppInfo හරහා අපේ URL එක සම්බන්ධ කරයි
    kb = [[types.InlineKeyboardButton(text="🚀 Open BOOSTME LANKA", web_app=WebAppInfo(url=WEB_APP_URL))]]
    markup = types.InlineKeyboardMarkup(inline_keyboard=kb)
    
    await message.answer(
        "සාදරයෙන් පිළිගනිමු! අපගේ නිල Web App එක විවෘත කිරීමට පහත බොත්තම ඔබන්න.",
        reply_markup=markup
    )

# --- 3. RUNNING BOTH ---
async def run_bot():
    await dp.start_polling(bot)

if __name__ == "__main__":
    # FastAPI සර්වර් එක පණ ගන්වයි (Port 80 හෝ 443 ඔබේ VPS එකේ විවෘතව තිබිය යුතුය)
    loop = asyncio.get_event_loop()
    loop.create_task(run_bot()) # බොට් එක background එකේ රන් කරයි
    uvicorn.run(app, host="0.0.0.0", port=8000) # වෙබ් ඇප් එක පණ ගන්වයි