#!/usr/bin/env python3
"""AI calculator prototype: normal maths, photo questions, and AI chat.

Commands at the prompt:
  <expression>     e.g. 3*(4+5)**2/7   -> evaluated locally, no AI
  snap [question]  take a photo and ask Claude about it
  ask <question>   text-only question to Claude
  quit

STUDY / HOMEWORK USE ONLY. Not allowed in exams (see GUIDE.md).
"""
import ast
import base64
import io
import math
import operator
import os
import sys

MODEL = "claude-sonnet-5-5"
SYSTEM = (
    "You are a maths and science tutor on a student's calculator. "
    "Explain step by step, show the working, keep answers short, and "
    "give the final answer clearly. Use plain text, not LaTeX."
)

# ---- safe local calculator (no eval) ---------------------------------------
_OPS = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
    ast.Div: operator.truediv, ast.Pow: operator.pow, ast.Mod: operator.mod,
    ast.USub: operator.neg, ast.UAdd: operator.pos,
}
_NAMES = {
    "pi": math.pi, "e": math.e,
    "sin": lambda x: math.sin(math.radians(x)),
    "cos": lambda x: math.cos(math.radians(x)),
    "tan": lambda x: math.tan(math.radians(x)),
    "sqrt": math.sqrt, "ln": math.log, "log": math.log10, "abs": abs,
}


def calc(expr):
    def ev(n):
        if isinstance(n, ast.Expression):
            return ev(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return n.value
        if isinstance(n, ast.BinOp) and type(n.op) in _OPS:
            return _OPS[type(n.op)](ev(n.left), ev(n.right))
        if isinstance(n, ast.UnaryOp) and type(n.op) in _OPS:
            return _OPS[type(n.op)](ev(n.operand))
        if isinstance(n, ast.Name) and n.id in _NAMES:
            return _NAMES[n.id]
        if (isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
                and n.func.id in _NAMES and not n.keywords):
            return _NAMES[n.func.id](*[ev(a) for a in n.args])
        raise ValueError("unsupported expression")
    return ev(ast.parse(expr, mode="eval"))


# ---- camera -----------------------------------------------------------------
def capture_jpeg():
    """Return JPEG bytes from the Pi camera, or a USB/laptop webcam."""
    try:
        from picamera2 import Picamera2
        cam = Picamera2()
        cam.configure(cam.create_still_configuration(main={"size": (1600, 1200)}))
        cam.start()
        buf = io.BytesIO()
        cam.capture_file(buf, format="jpeg")
        cam.stop()
        cam.close()
        return buf.getvalue()
    except ImportError:
        import cv2
        cap = cv2.VideoCapture(0)
        ok, frame = cap.read()
        cap.release()
        if not ok:
            raise RuntimeError("no camera found")
        return cv2.imencode(".jpg", frame)[1].tobytes()


# ---- Claude -----------------------------------------------------------------
def client():
    import anthropic
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY first (console.anthropic.com).")
    return anthropic.Anthropic()


def ask(question, jpeg=None):
    content = []
    if jpeg:
        content.append({"type": "image", "source": {
            "type": "base64", "media_type": "image/jpeg",
            "data": base64.b64encode(jpeg).decode()}})
    content.append({"type": "text", "text": question})
    msg = client().messages.create(
        model=MODEL, max_tokens=1024, system=SYSTEM,
        messages=[{"role": "user", "content": content}])
    return "".join(b.text for b in msg.content if b.type == "text")


def main():
    print(__doc__)
    while True:
        try:
            line = input("calc> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not line:
            continue
        if line in ("quit", "exit"):
            break
        try:
            if line.startswith("snap"):
                q = line[4:].strip() or "Solve the problem in this photo step by step."
                print("Taking photo...")
                print(ask(q, capture_jpeg()))
            elif line.startswith("ask "):
                print(ask(line[4:]))
            else:
                print(calc(line))
        except Exception as exc:  # keep the loop alive on any error
            print("Error:", exc)


if __name__ == "__main__":
    main()
