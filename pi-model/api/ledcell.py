import RPi.GPIO as GPIO
import time
from hx711 import HX711
from sharewei import save_weight

# ==== HX711 CONFIGURATION ====
DT = 24
SCK = 23
hx = HX711(DT, SCK)

GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)

hx.set_reading_format("MSB", "MSB")
hx.set_reference_unit(1091.51)
hx.reset()
print("Taring... Please wait")
hx.tare()
print("Tare complete!")

# ==== 74HC595 7-SEGMENT CONFIG ====
SCLK = 6
RCLK = 5
DIO  = 4

GPIO.setup(SCLK, GPIO.OUT)
GPIO.setup(RCLK, GPIO.OUT)
GPIO.setup(DIO,  GPIO.OUT)

SEGMENT_MAP = [
    0xC0, 0xF9, 0xA4, 0xB0, 0x99,
    0x92, 0x82, 0xF8, 0x80, 0x90,
    0x88, 0x80, 0xC6, 0xA1, 0x86,
    0x8E, 0xBF
]

def shift_out(byte_data):
    for i in range(8):
        GPIO.output(DIO, (byte_data & 0x80) != 0)
        byte_data <<= 1
        GPIO.output(SCLK, GPIO.LOW)
        GPIO.output(SCLK, GPIO.HIGH)

def led_out(segment_byte, digit_select):
    GPIO.output(RCLK, GPIO.LOW)
    shift_out(segment_byte)
    shift_out(digit_select)
    GPIO.output(RCLK, GPIO.HIGH)

def display_number(number):
    digits = [0, 0, 0, 0]
    number = max(0, min(9999, int(round(number))))
    digits[0] = number % 10
    digits[1] = (number // 10) % 10
    digits[2] = (number // 100) % 10
    digits[3] = (number // 1000) % 10

    for _ in range(50):
        for i in range(4):
            led_out(SEGMENT_MAP[digits[i]], 1 << i)
            time.sleep(0.002)

# ==== ONE-SHOT WEIGHING STATE MACHINE ====
state = "IDLE"
measured_weight = 0

try:
    while True:
        reading = hx.get_weight(3)

        if state == "IDLE":
            if reading > 5:
                print("Object detected! Measuring...")
                weights = []
                for _ in range(10):
                    weights.append(hx.get_weight(1))
                measured_weight = sum(weights) / len(weights)
                print(f"Measured: {measured_weight:.2f} g")
                save_weight(measured_weight)
                display_number(measured_weight)
                state = "WAIT_REMOVE"

        elif state == "WAIT_REMOVE":
            if reading < 2:
                print("Object removed. Ready for next.")
                measured_weight = 0
                state = "IDLE"
            else:
                display_number(measured_weight)  # Still show old value

        hx.power_down()
        time.sleep(0.05)
        hx.power_up()
        time.sleep(0.1)

except KeyboardInterrupt:
    print("Exiting...")
    GPIO.cleanup()
