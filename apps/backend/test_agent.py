"""End-to-end booking flow test."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from agents import Runner, RunConfig
from database import init_db
from agent import booking_agent

RUN_CONFIG = RunConfig(workflow_name="Salon Booking Agent — Test")


async def chat(history: list, user_msg: str) -> str:
    history.append({"role": "user", "content": user_msg})
    result = await Runner.run(booking_agent, history, run_config=RUN_CONFIG)
    reply = result.final_output
    history.append({"role": "assistant", "content": reply})
    print(f"User : {user_msg}")
    print(f"Zara : {reply}\n")
    return reply


async def main():
    init_db()
    print("=== Full Booking Flow Test ===\n")

    history = []
    await chat(history, "Hi, I'd like to book a facial for this Saturday at 11am")
    await chat(history, "My name is Ayesha Malik")
    await chat(history, "ayesha.malik@example.com")
    await chat(history, "Yes, 11am Saturday works perfectly")

    print("=== Test complete — check platform.openai.com/traces for the trace ===")


if __name__ == "__main__":
    asyncio.run(main())
