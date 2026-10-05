# AI + Camera Calculator: build guide

A pocket device that works as a normal calculator, can photograph a problem,
and sends it to Claude for a step-by-step explanation.

## 0. Read this first

### Exams
You said you want a legal baseline. Here is the honest split:

| Device | Exam use (AQA / Pearson / JCQ rules) |
|---|---|
| Standard scientific calculator (e.g. Casio fx-991EX ClassWiz, fx-991CW) | Normally allowed. This is your "most advanced legal" baseline. |
| This AI + camera device | **Banned.** Exam rules prohibit anything with a camera, internet/wireless connection, or a way to communicate or retrieve stored info. Bringing it into an exam is malpractice and can lose you the whole qualification. |

Also check the current rules for your paper. Pearson and AQA lists change, and
some boards restrict CAS/graphing models. I can't verify today's lists from
here, so confirm with your exams officer or the JCQ "Instructions for
Conducting Examinations" document.

So the plan is: **carry the legal calculator into the exam; use this device for
study, homework and the experiment.** The software below keeps the normal
calculator behaviour so you can compare the two side by side.

### Connecting your Claude Pro account
This isn't possible directly, and I don't recommend trying:

- A Claude Pro subscription covers the claude.ai website and apps only. It
  doesn't include API access, and there's no supported way to log a custom
  device into it.
- Scraping or automating the claude.ai login would break Anthropic's terms and
  would break constantly.
- What works: create an **API key** at console.anthropic.com. It's billed
  separately, pay-as-you-go, and a photo question costs a fraction of a cent to
  a few cents.

**Zero-build alternative:** the Claude app on your phone (Pro) already does
photo plus question. Hardware only adds the calculator form factor.

## 1. Hardware (about £120 / $150)

| Part | Notes |
|---|---|
| Raspberry Pi 5 (4 GB) | A Pi 4 or Pi Zero 2 W also works but is slower to boot |
| Raspberry Pi Camera Module 3 | Autofocus, good for reading paper. Pi 5 needs the small-connector camera cable |
| 3.5"-5" touchscreen (HDMI or DSI) | Optional: a small USB keyboard or numpad also works |
| microSD card, 32 GB+ | Class 10 / A1 |
| Power bank with USB-C PD (5V 3A) | Makes it portable |
| Pi 5 active cooler + case | Case with camera mount |
| Optional: Wi-Fi hotspot on your phone | The device needs internet to reach Claude |

No soldering is required for this baseline.

## 2. Set up the Pi

1. On your computer install **Raspberry Pi Imager**. Choose *Raspberry Pi OS
   (64-bit)*. Click the gear icon and set the hostname, username/password, Wi-Fi
   and enable SSH. Write it to the microSD.
2. Power the Pi off. Connect the camera ribbon (contacts facing the board,
   latch closed). Connect the screen. Insert the SD card. Power on.
3. Test the camera:
   ```bash
   rpicam-hello --timeout 3000
   rpicam-still -o test.jpg
   ```
4. Install the software:
   ```bash
   sudo apt update && sudo apt full-upgrade -y
   sudo apt install -y python3-picamera2 python3-venv
   git clone <this repo> && cd Majilis/ai-calculator
   python3 -m venv --system-site-packages .venv
   source .venv/bin/activate
   pip install anthropic
   ```
   `--system-site-packages` is needed so the venv can see `picamera2`.
5. Add your key (never commit it):
   ```bash
   echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.bashrc
   source ~/.bashrc
   ```
6. Run it:
   ```bash
   python calc_ai.py
   ```

## 3. Using it

```
calc> 3*(4+5)**2/7          # local calculator, no internet
calc> sin(30)+sqrt(16)      # degrees
calc> snap                  # photo -> "solve this step by step"
calc> snap what is the area of the shaded region?
calc> ask explain completing the square
```

Tips: use good light, hold the page flat and fill the frame with one question.

## 4. Testing on a laptop first

No Pi yet? Run it on any computer with a webcam:
```bash
pip install anthropic opencv-python
export ANTHROPIC_API_KEY=sk-ant-...
python calc_ai.py
```
The script falls back to OpenCV when `picamera2` isn't installed.

## 5. Making it feel like a calculator

- **Auto-start on boot:** add a systemd service or put
  `cd ~/Majilis/ai-calculator && .venv/bin/python calc_ai.py` in a
  `~/.config/autostart` entry.
- **Physical Snap button:** wire a push button between GPIO17 and GND, then
  use `gpiozero.Button(17).when_pressed` to call `capture_jpeg()` and `ask()`.
- **Touch UI:** wrap `calc()` and `ask()` in a Tkinter or Kivy keypad.
- **Cost control:** the script caps `max_tokens` at 1024 and downsizes the
  photo to 1600x1200. Set a monthly spend limit in the console.

## 6. Notes for the experiment write-up

- Privacy: photos are sent to Anthropic's API. Don't photograph other people.
- Accuracy: the AI can make mistakes. Check answers with the local calculator
  mode, which is deterministic.
- Academic integrity: use the AI to learn from the working, not to copy
  answers into assessed coursework unless your teacher allows it.
