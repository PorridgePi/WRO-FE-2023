# WRO 2023 Future Engineers

[![PlatformIO CI](https://github.com/PorridgePi/WRO-FE-2023/actions/workflows/platformio-ci.yml/badge.svg?branch=main)](https://github.com/PorridgePi/WRO-FE-2023/actions/workflows/platformio-ci.yml)

# Team Information

Team ID: `FE0901`

Team Name: `raffles institution team 3`

Team Members
- [Yikun](https://github.com/PorridgePi)
- [Zachary](https://github.com/Zachareeeeee)

# Overview

Welcome to the GitHub repository for Team `FE0901` participating in WRO 2023. In this competition, we are building an autonomous robotic vehicle capable of completing 2 different challenges. This README provides a simple overview. If you wish to delve deeper into our engineering process, please check out our [Engineering Journal](docs/Engineering%20Journal.md) or [download it as PDF](https://github.com/PorridgePi/WRO-FE-2023/blob/main/docs/Engineering%20Journal.pdf).

## Demo

A demonstration video of our robot in action can be found on YouTube (or in the [video.md](video/video.md) file): [https://youtu.be/pbWbQL5pThI](https://youtu.be/pbWbQL5pThI)

[![Watch the video](https://img.youtube.com/vi/pbWbQL5pThI/hqdefault.jpg)](https://www.youtube.com/embed/pbWbQL5pThI)

### Key Timestamps
Open Challenge
- Run 1: [00:03](https://youtu.be/pbWbQL5pThI&t=3)
- Runs 2 & 3: [01:15](https://youtu.be/pbWbQL5pThI&t=75)

Obstacle Challenge:
- Run 1: [03:40](https://youtu.be/pbWbQL5pThI&t=221)

# Usage
For Code, Using Visual Studio Code:
- Clone this repository: `git clone https://github.com/PorridgePi/WRO-FE-2023`
- Change directory: `cd ./WRO-FE-2023/`
- Initialise Git submodule(s): `git submodule update --init --recursive`
- Open the repository in VSCode: `code ./`
- Install the PlatformIO plugin
- Select the appropriate PlatformIO Environment
- Use the PlatformIO plugin to compile and upload code onto the microcontroller (Raspberry PI Pico)

For Camera (OpenMV): Using the [OpenMV IDE](https://openmv.io/pages/download)
- Open the camera code (`src/omv_main.py`) in OpenMV IDE
- Upload code onto OpenMV by:
    - Select `Tools` Menu
    - Click `Save open script onto OpenMV Cam (as main.py)`

For Documentation, Using [Obsidian](https://obsidian.md/):
- Clone this repository: `git clone https://github.com/PorridgePi/WRO-FE-2023`
- Open the cloned directory as a Vault

For PCB, Using [KiCAD](https://www.kicad.org/):
- Clone this repository: `git clone https://github.com/PorridgePi/WRO-FE-2023`
- Open the file `schemes/WRO_2023/WRO_2023.kicad_pro`

# Repository Content
- `.github/workflows/platformio-ci.yml`: GitHub Actions CI workflow for PlatformIO ([Documentation](https://docs.platformio.org/en/latest/integration/ci/github-actions.html))
- `.vscode/`: Folder containing VSCode workspace settings
    - `extensions.json`: List of recommended and unwanted extensions ([Documentation](https://code.visualstudio.com/docs/editor/extension-gallery#_workspace-recommended-extensions))
- `models/`: 3D models
- `others/`: Other files
- `schemes/`: Schematic diagram and PCB
    - `WRO_2023`: PCB files that can be opened in KiCAD
- `scripts/`: Scripts for PlatformIO
    - `ci.sh`: Script for CI test
    - `extra_scripts.py`: Extra scripts for PlatformIO (run before and after build - [Documentation](https://docs.platformio.org/en/latest/scripting/actions.html))
- `src/`: Main code
    - `lib/`: Libraries for components
        - Notably:
            - `lib/private/Common.h`: Shared code between `open.cpp` and `obstacle.cpp`
            - `lib/Mecha_QMC5883L`: [Forked version](https://github.com/PorridgePi/Mecha_QMC5883L) of library for the QMC5883L magnetometer
    - `test/`: Test code
    - `main.cpp`: Placeholder file
    - `obstacle.cpp`: Code for the Obstacle Challenge
    - `open.cpp`: Code for the Open Challenge
- `t-photos`: Team photo
- `v-photos`: Photos of the vehicle (from many different angles!)
- `video`: Contains [video.md](video/video.md) with the link to the video of the driving demonstration
- `.clang-format`: ClangFormat code style file - to format code in VSCode
- `.gitignore`: gitignore file ([Documentation](https://git-scm.com/docs/gitignore))
- `platformio.ini`: PlatformIO configuration file ([Documentation](https://docs.platformio.org/en/stable/projectconf/index.html))
- `README.md`: This file

# Reminders before Running
1. Calibrate compass(es)
2. Ensure steering mechanism is tightened
3. Clean wheels to ensure grip

# Hardware used
- **Motor:** 1x GM25-12CPR 
- **Servo:** 1x MG996R
- **Motor Driver:** 1x AT8236
- **Microcontroller:** 1x Raspberry Pi Pico
- **Voltage Regulator (5V):** 1x CKCS-BK-2
- **LiDAR:** 5x TF-Luna
- **Camera:** 1x OpenMV M7
- **Compass:** 1x GY-273 and 1x GY-271
- **Battery:** 1x Turnigy nano-tech 1300mAh 3S 45~90C Lipo Pack

# Continual Integration (CI) Testing

We have a simple CI testing setup with GitHub Actions, using the `scripts/ci.sh` script to automate the process of building our code for all different environments in `platformio.ini`. It checks for build success and ensures that the code can be successfully compiled.

CI is a critical aspect of our development process. It allows us to detect issues and errors in our codebase as soon as they occur. This early detection is invaluable in preventing the accumulation of errors and simplifying debugging.

Besides, our project involves multiple team members working collaboratively. CI ensures that all code changes made by different team members do not introduce regressions or break existing functionality.

To check the status of our CI, go to the [`Actions` tab](https://github.com/PorridgePi/WRO-FE-2023/actions) and view the workflow runs. If everything is going well, you should be only seeing green ticks. However, if you are seeing red crosses, something is up, but don't fret, we are definitely working hard to iron out the bugs!

(or alternatively, just look at the badge below for the CI status)

[![PlatformIO CI](https://github.com/PorridgePi/WRO-FE-2023/actions/workflows/platformio-ci.yml/badge.svg?branch=main)](https://github.com/PorridgePi/WRO-FE-2023/actions/workflows/platformio-ci.yml)
