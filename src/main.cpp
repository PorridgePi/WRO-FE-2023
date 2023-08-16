#include <Arduino.h>
#include <Definitions.h>
#include <CommonUtils.h>
#include <Button.h>
#include <Motor.h>
#include <DriveServo.h>
#include <MechaQMC5883.h>
#include <Lidar.h>


volatile int ticks = 0;

void checkEncoder() {
  if (digitalRead(PIN_ENCODER_A) == digitalRead(PIN_ENCODER_B)) {
    ticks++;
  } else {
    ticks--;
  }
}


#define DEBUG_PRINT true
#define DIRECTION -1
#define SPEED 0.5

Button button(PIN_BUTTON_A, PIN_BUTTON_B);
Motor motor(PIN_MOTOR_A, PIN_MOTOR_B);
DriveServo servo(PIN_SERVO);
MechaQMC5883 imu(Wire, 569.5, 89.5, 0.938978508806, 14.7584706712);
Lidar frontLidar(Wire, 0x10);

float speed = 0, turnRatio = 0;
int currentCase = 0;
int encoderCount = 0;

bool turn(float angle) {
    static float targetAngle = -1;
    if (targetAngle == -1) {
        targetAngle = LIM_ANGLE(imu.readAngle() + 90);
    }

    float currentAngle = imu.readAngle();

    float turnAngle = ANGLE_360_TO_180(LIM_ANGLE(targetAngle - currentAngle));

    DPRINT(turnAngle);

    if (turnAngle > -1) {
        turnRatio = turnAngle > 0 ? 1 : -1;
        speed = SPEED;
        DPRINT(currentAngle);
        DPRINT(targetAngle);
        DPRINT(turnRatio);
        return false;
    } else {
        targetAngle = -1;
        return true;
    }
}

void setupComponents() {
    // I2C for LiDAR and IMU
    Wire.setSCL(PIN_WIRE0_SCL);
    Wire.setSDA(PIN_WIRE0_SDA);
    Wire.setTimeout(1); // set timeout to 1 ms
    Wire.begin();
    Wire1.setSCL(PIN_WIRE1_SCL);
    Wire1.setSDA(PIN_WIRE1_SDA);
    Wire1.setTimeout(1); // set timeout to 1 ms
    Wire1.begin();

    // Servo
    servo.init();

    // IMU
    imu.init();
    imu.tare();

    // Encoder
    attachInterrupt(digitalPinToInterrupt(PIN_ENCODER_A), checkEncoder, CHANGE);
}

void update() {
    encoderCount = ticks * DIRECTION;
}

void setup() {
    setupComponents();
    Serial.begin(115200);
}

void loop() {
    update();
    static float targetAngle = -1;
    speed = SPEED;
    static int sideCount = 0;

    switch (currentCase) {
    case 0: // stop
        speed = 0;
        turnRatio = 0;
        sideCount = 0;
        if (button.isPressed()) {
            currentCase = 1;
        }
        break;
    case 1:
        speed = SPEED;
        turnRatio = 0;
        if (frontLidar.read() < 40) {
            currentCase = 2;
        }
        break;
    case 2:
        if (turn(90)) {
            sideCount++;
            if (sideCount < 4) {
                currentCase = 1;
            } else {
                currentCase = 0;
            }
        }
        break;
    }

    DPRINT(currentCase);
    DPRINT(frontLidar.read());

    DPRINT(encoderCount);

    DPRINT(imu.readAngle());
    DPRINT(speed);
    DPRINT(turnRatio);

    Serial.println();

    servo.turn(turnRatio * DIRECTION);
    motor.setSpeed(speed * DIRECTION);
}

void loop1() {
  blinkLED();
}
