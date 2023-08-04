#include <Arduino.h>
#include <Definitions.h>
#include <CommonUtils.h>
#include <Lidar.h>

Lidar lidar(Wire, 0x12, 0);

void setup() {
    Serial.begin(115200);
    Wire.setSCL(PIN_WIRE0_SCL);
    Wire.setSDA(PIN_WIRE0_SDA);
    Wire.setTimeout(1); // set timeout to 1 ms
    Wire.begin();
    Wire1.setSCL(PIN_WIRE1_SCL);
    Wire1.setSDA(PIN_WIRE1_SDA);
    Wire1.setTimeout(1); // set timeout to 1 ms
    Wire1.begin();
}

void loop() {
    Serial.println(lidar.read());
}

void loop1() {
    blinkLED();
}
