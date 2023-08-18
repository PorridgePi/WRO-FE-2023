#define IS_PROTOBOARD

#include <Arduino.h>
#include <CommonUtils.h>
#include <Definitions.h>
#include <Servo.h>

float displacement = 0;

#define WHEEL_DIAMETER 6.5
#define SERVO_LEFT 1000
#define SERVO_MIDDLE 1500
#define SERVO_RIGHT 2000
#define SERVO_MAX_ANGLE 30

Servo servo;

void updateDisplacement() {
    static int aState, aLastState, count;
    aState = digitalRead(PIN_ENCODER_A); // Reads the "current" state of the outputA
    // If the previous and the current state of the outputA are different, that means a Pulse has occured
   if (aState != aLastState){
     // If the outputB state is different to the outputA state, that means the encoder is rotating clockwise
     if (digitalRead(PIN_ENCODER_B) != aState) { 
       count ++;
     } else {
       count --;
     }
   } 
   aLastState = aState; // Updates the previous state of the outputA with the current state

    float sumAngle     = count / 4.0f;
    displacement = sumAngle / 360.0f * PI * WHEEL_DIAMETER;
}

void steer(float angle) {
    float writeMS;
    if (angle == 0) {
        writeMS = SERVO_MIDDLE;
    } else {
        angle = constrain(angle, -SERVO_MAX_ANGLE, SERVO_MAX_ANGLE);
        if (angle > 0) {
            writeMS = map(angle, 0, SERVO_MAX_ANGLE, SERVO_MIDDLE, SERVO_RIGHT);
        } else {
            writeMS = map(angle, -SERVO_MAX_ANGLE, 0, SERVO_LEFT, SERVO_MIDDLE);
        }
    }
    servo.writeMicroseconds(writeMS);
}

void setup() {
    pinMode(PIN_LED, OUTPUT);
    Serial.begin(115200);
    pinMode(PIN_ENCODER_A, INPUT);
    pinMode(PIN_ENCODER_B, INPUT);
    pinMode(PIN_MOTOR_A, OUTPUT);
    pinMode(PIN_MOTOR_B, OUTPUT);
    pinMode(PIN_MOTOR_PWM, OUTPUT);
    pinMode(PIN_MOTOR_EN, OUTPUT);
    delay(5000);
}

bool isMotorEnabled = true;

void setDrive(float speed) {
    if (!isMotorEnabled) {
        digitalWrite(PIN_MOTOR_EN, LOW);
        return;
    } else {
        digitalWrite(PIN_MOTOR_EN, HIGH);
    }
    speed = constrain(speed, -1, 1);
    if (speed > 0) {
        digitalWrite(PIN_MOTOR_A, HIGH);
        digitalWrite(PIN_MOTOR_B, LOW);
    } else {
        digitalWrite(PIN_MOTOR_A, LOW);
        digitalWrite(PIN_MOTOR_B, HIGH);
    }
    analogWrite(PIN_MOTOR_PWM, abs(speed) * 255);
}

float moveTarget = -1;

float moveDistance(float distance) {
    
    if (moveTarget == -1) {
        moveTarget = displacement + distance;
    }

    if (abs(moveTarget - displacement) < 0.05) {
        return 0;
    } else {
        float distLeft = moveTarget - displacement;
        return copysign(min(0.5, abs(distLeft) / 1.0f), distLeft);
    }
}

int state = 0; // 0 - forward, 1 - right turn
int sideCount = 0;
void loop() {
    float speed, steerAngle;
    updateDisplacement();

    state = 1;
    if (state == 0) {
        speed = moveDistance(100);
        steerAngle = 0;
        if (speed == 0) {
            moveTarget = -1;
            state = 1;
        }
    } else if (state == 1) {
        speed = moveDistance(60);
        steerAngle = 30;
        if (speed == 0) {
            sideCount++;
            moveTarget = -1;
            state = 0;
        }
    }
    steer(steerAngle);
    
    if (displacement >= 270) {
        isMotorEnabled = false;
    }

    setDrive(speed);


    static unsigned long lastPrint = millis();
    if (millis() - lastPrint > 10) {
        Serial.print(displacement);
        Serial.println();
        lastPrint = millis();
    }
    servo.attach(PIN_SERVO);
}

void loop1() {
    blinkLED();
}
