import re
import time
import tkinter as tk
import traceback
from tkinter import messagebox
from pathlib import Path

import easyocr
import numpy as np
import pyautogui
from PIL import ImageGrab
from sympy import Eq, N, solve, sympify, symbols


MAX_ROUNDS = 25
ROUND_DELAY_SECONDS = 0.8
REPEAT_QUESTION_DELAY_SECONDS = 0.25
CAPTURE_DELAY_SECONDS = 3
BORDER_THICKNESS = 3
LOG_FILE = Path(__file__).with_name("solver_debug.log")


def log_exception(prefix, exc):
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] {prefix}: {exc}\n")
        f.write(traceback.format_exc())
        f.write("\n")


class QuestionSolver:
    def __init__(self, question_area, max_rounds):
        self.question_area = question_area
        self.max_rounds = max_rounds
        self.reader = self._build_reader()
        self.operator_clean = re.compile(r"[^\d\sxX\+\-\*/\(\)=\?×÷:]")
        self.space_clean = re.compile(r"\s*([\+\-\*/\(\)=])\s*")
        self.x_symbol = symbols("x")

    @staticmethod
    def _build_reader():
        try:
            return easyocr.Reader(["en"], gpu=True)
        except Exception:
            print("EasyOCR GPU init failed, falling back to CPU.")
            try:
                return easyocr.Reader(["en"], gpu=False)
            except Exception as e:
                msg = str(e)
                if "CERTIFICATE_VERIFY_FAILED" in msg:
                    raise RuntimeError(
                        "EasyOCR could not download model files due to SSL certificate verification failure.\n\n"
                        "Fix options:\n"
                        "1) Run the macOS Python certificate installer (Install Certificates.command)\n"
                        "2) Or run: python3 -m pip install --upgrade certifi\n"
                        "3) Then run this script again so EasyOCR can download its model once."
                    ) from e
                raise

    def normalize_text(self, text):
        expr = text.strip()
        expr = expr.replace("×", "*").replace("÷", "/").replace(":", "/")
        expr = re.sub(r"(?<=\d)\s*[xX]\s*(?=\d)", "*", expr)
        expr = self.operator_clean.sub("", expr)
        expr = self.space_clean.sub(r"\1", expr)

        paren_diff = expr.count("(") - expr.count(")")
        if paren_diff > 0:
            expr += ")" * paren_diff

        return expr

    def solve_expression(self, expr):
        try:
            if not expr:
                return None

            if "=" in expr or "?" in expr:
                eq_expr = expr.replace("?", "x")
                if "=" not in eq_expr:
                    return None

                lhs, rhs = eq_expr.split("=", 1)
                solutions = solve(Eq(sympify(lhs), sympify(rhs)), self.x_symbol)
                if not solutions:
                    return None

                val = N(solutions[0])
                if val.is_real:
                    num = float(val)
                    if abs(num - round(num)) < 1e-9:
                        return str(int(round(num)))
                    return f"{num:.6f}".rstrip("0").rstrip(".")
                return None

            result = N(sympify(expr))
            if not result.is_real:
                return None

            num = float(result)
            if abs(num - round(num)) < 1e-9:
                return str(int(round(num)))
            return f"{num:.6f}".rstrip("0").rstrip(".")
        except Exception:
            return None

    def read_question(self):
        img = ImageGrab.grab(bbox=self.question_area)
        img_arr = np.array(img.convert("L"))
        img_arr[img_arr < 145] = 0
        img_arr[img_arr >= 145] = 255

        result = self.reader.readtext(
            img_arr,
            allowlist="0123456789+-*/()=?xX×÷: ",
            low_text=0.3,




            
            min_size=5,
            batch_size=4,
        )

        if not result:
            return ""

        return " ".join(text for _, text, _ in result).strip()

    def run(self):
        print(f"Selected question area: {self.question_area}")
        print(f"Starting automation for {self.max_rounds} rounds...")
        print("Switch to your game/input field now. Starting in 2 seconds...")
        print("Move mouse to top-left corner at any time to stop (pyautogui fail-safe).")
        time.sleep(2.0)

        completed_rounds = 0
        last_seen_expr = None

        while completed_rounds < self.max_rounds:
            try:
                # Safe manual stop: hold mouse in top-left corner.
                pos = pyautogui.position()
                if pos.x <= 2 and pos.y <= 2:
                    print("Top-left stop triggered. Stopping...")
                    break

                raw_question = self.read_question()
                expr = self.normalize_text(raw_question)

                # Ignore duplicate OCR reads so the same question is not counted twice.
                if expr and expr == last_seen_expr:
                    time.sleep(REPEAT_QUESTION_DELAY_SECONDS)
                    continue

                answer = self.solve_expression(expr)
                round_num = completed_rounds + 1

                if answer is None:
                    print(f"[{round_num}/{self.max_rounds}] No valid question -> Enter")
                    pyautogui.press("enter")
                else:
                    print(f"[{round_num}/{self.max_rounds}] {raw_question} -> {answer}")
                    pyautogui.typewrite(answer, interval=0.02)
                    pyautogui.press("enter")
                    if expr:
                        last_seen_expr = expr

                completed_rounds += 1

                time.sleep(ROUND_DELAY_SECONDS)
            except pyautogui.FailSafeException:
                print("Fail-safe triggered. Stopping.")
                break
            except Exception as e:
                round_num = completed_rounds + 1
                print(f"[{round_num}/{self.max_rounds}] Error: {e} -> Enter")
                pyautogui.press("enter")
                completed_rounds += 1
                time.sleep(ROUND_DELAY_SECONDS)

        print("Finished.")


class SelectorApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Question Box Selector")
        self.root.geometry("420x220+60+60")
        self.root.resizable(False, False)
        self.root.attributes("-topmost", True)

        self.top_left = None
        self.bottom_right = None
        self.bbox = None
        self.border_windows = []
        self._capture_target = None

        self.status_var = tk.StringVar(value="Set top-left, then bottom-right.")
        self.coords_var = tk.StringVar(value="Area: not set")
        self.rounds_var = tk.StringVar(value=str(MAX_ROUNDS))

        self._build_ui()

    def _build_ui(self):
        tk.Label(
            self.root,
            text="Select question area outside this window",
            font=("Arial", 12, "bold"),
        ).pack(pady=(12, 6))

        tk.Label(
            self.root,
            text="1) Move mouse to top-left and click 'Capture Top-Left'\n"
            "2) Move mouse to bottom-right and click 'Capture Bottom-Right'",
            justify="left",
            font=("Arial", 9),
        ).pack()

        row = tk.Frame(self.root)
        row.pack(pady=8)

        tk.Button(row, text="Capture Top-Left", width=18, command=self.capture_top_left).pack(side="left", padx=4)
        tk.Button(row, text="Capture Bottom-Right", width=18, command=self.capture_bottom_right).pack(side="left", padx=4)

        tk.Label(self.root, textvariable=self.status_var, fg="white", font=("Arial", 9, "bold")).pack(pady=3)
        tk.Label(self.root, textvariable=self.coords_var, fg="black", font=("Consolas", 10)).pack(pady=2)

        rounds_row = tk.Frame(self.root)
        rounds_row.pack(pady=2)
        tk.Label(rounds_row, text="Rounds:", font=("Arial", 10, "bold")).pack(side="left", padx=(0, 6))
        tk.Entry(rounds_row, textvariable=self.rounds_var, width=8, justify="center").pack(side="left")

        self.start_button = tk.Button(
            self.root,
            text="Start",
            width=24,
            state="disabled",
            command=self.start_solver,
        )
        self.start_button.pack(pady=10)

    def capture_top_left(self):
        self._capture_point("top_left")

    def capture_bottom_right(self):
        self._capture_point("bottom_right")

    def _capture_point(self, target):
        self._capture_target = target
        self.status_var.set(f"Capturing {target.replace('_', '-')} in {CAPTURE_DELAY_SECONDS}s... move mouse now")
        self.root.after(CAPTURE_DELAY_SECONDS * 1000, self._finalize_capture)

    def _finalize_capture(self):
        if self._capture_target is None:
            return

        pos = pyautogui.position()
        if self._capture_target == "top_left":
            self.top_left = (int(pos.x), int(pos.y))
            self.status_var.set(f"Top-left set to {self.top_left}")
        elif self._capture_target == "bottom_right":
            self.bottom_right = (int(pos.x), int(pos.y))
            self.status_var.set(f"Bottom-right set to {self.bottom_right}")

        self._capture_target = None
        self._update_bbox_and_indicator()

    def _update_bbox_and_indicator(self):
        if not self.top_left or not self.bottom_right:
            return

        x1, y1 = self.top_left
        x2, y2 = self.bottom_right

        left = min(x1, x2)
        top = min(y1, y2)
        right = max(x1, x2)
        bottom = max(y1, y2)

        if right - left < 10 or bottom - top < 10:
            self.coords_var.set("Area too small (min 10x10). Re-capture points.")
            self.start_button.config(state="disabled")
            self._destroy_indicator()
            self.bbox = None
            return

        self.bbox = (left, top, right, bottom)
        self.coords_var.set(f"Area: ({left}, {top}) -> ({right}, {bottom})")
        self.start_button.config(state="normal")
        self._show_indicator(self.bbox)

    def _destroy_indicator(self):
        for win in self.border_windows:
            try:
                win.destroy()
            except Exception:
                pass
        self.border_windows = []

    def _make_border_window(self, x, y, w, h):
        win = tk.Toplevel(self.root)
        win.overrideredirect(True)
        win.attributes("-topmost", True)
        win.geometry(f"{w}x{h}+{x}+{y}")
        win.configure(bg="red")
        self.border_windows.append(win)

    def _show_indicator(self, bbox):
        self._destroy_indicator()

        left, top, right, bottom = bbox
        width = right - left
        height = bottom - top
        t = BORDER_THICKNESS

        self._make_border_window(left, top, width, t)
        self._make_border_window(left, bottom - t, width, t)
        self._make_border_window(left, top, t, height)
        self._make_border_window(right - t, top, t, height)

    def start_solver(self):
        if not self.bbox:
            return

        try:
            rounds = int(self.rounds_var.get().strip())
            if rounds <= 0:
                raise ValueError
        except Exception:
            messagebox.showerror("Invalid Rounds", "Rounds must be a positive whole number.")
            return

        self.status_var.set("Starting OCR engine...")
        self.root.update_idletasks()

        try:
            solver = QuestionSolver(self.bbox, rounds)
        except Exception as e:
            log_exception("Start Failed", e)
            try:
                messagebox.showerror("Start Failed", f"Could not start solver:\n{e}")
            except Exception:
                pass
            self.status_var.set("Start failed. See error popup.")
            print(f"Start failed: {e}")
            print(f"Debug log: {LOG_FILE}")
            return

        self._destroy_indicator()
        self.root.withdraw()
        self.root.after(100, lambda: self._run_solver(solver))

    def _run_solver(self, solver):
        try:
            solver.run()
        except Exception as e:
            log_exception("Runtime Error", e)
            try:
                messagebox.showerror("Runtime Error", f"Solver crashed:\n{e}")
            except Exception:
                pass
            print(f"Runtime error: {e}")
            print(f"Debug log: {LOG_FILE}")
        finally:
            try:
                self.root.destroy()
            except Exception:
                pass

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    try:
        SelectorApp().run()
    except Exception as e:
        log_exception("Fatal Error", e)
        print(f"Fatal error: {e}")
        print(f"Debug log: {LOG_FILE}")
