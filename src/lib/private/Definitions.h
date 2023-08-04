#ifndef DEFINITIONS_H
#define DEFINITIONS_H

#ifndef IS_PROTOBOARD

#define WHEEL_DIAMETER 6.5 // cm

#define PIN_WIRE0_SCL 13
#define PIN_WIRE0_SDA 12

#define PIN_WIRE1_SCL 15
#define PIN_WIRE1_SDA 14

#define PIN_MOTOR_A 18
#define PIN_MOTOR_B 19

#define PIN_BUTTON_A 8
#define PIN_BUTTON_B 9

#define PIN_ENCODER_A 20
#define PIN_ENCODER_B 21

#define PIN_SERVO 22

#else // Below for Protoboard

#define PIN_MOTOR_A 17
#define PIN_MOTOR_B 16
#define PIN_MOTOR_PWM 21
#define PIN_MOTOR_EN 27

#define PIN_ENCODER_A 15
#define PIN_ENCODER_B 14

#define PIN_SERVO 22

#endif

#endif