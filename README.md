# WRO 2023 Future Engineers

## Usage

Using Visual Studio Code:
- Clone this repository
- Change directory
- Initialise Git submodule(s): `git submodule update --init --recursive`
- Open the repository in VSCode
- Install the PlatformIO plugin
- Use the PlatformIO plugin to compile and upload code onto the microcontrollers

## Code Structure
- `.github/workflows/platformio-ci.yml`: GitHub Actions CI workflow for PlatformIO ([Documentation](https://docs.platformio.org/en/latest/integration/ci/github-actions.html))
- `.vscode/`: Folder containing VSCode workspace settings
    - `extensions.json`: List of recommended and unwanted extensions ([Documentation](https://code.visualstudio.com/docs/editor/extension-gallery#_workspace-recommended-extensions))
- `lib/`: Libraries for components
    - `private/`: Our own libraries for components
    - `public/`: Libraries from other sources
- `scripts/`: Scripts for PlatformIO
    - `ci.sh`: Script for CI test
    - `extra_scripts.py`: Extra scripts for PlatformIO (run before and after build - [Documentation](https://docs.platformio.org/en/latest/scripting/actions.html))
- `src/`: Main code
    - `test/`: Test code
    - `main.cpp`: Main code for Raspberry Pi Pico
- `.clang-format`: ClangFormat code style file - to format code in VSCode
- `.gitignore`: gitignore file ([Documentation](https://git-scm.com/docs/gitignore))
- `platformio.ini`: PlatformIO configuration file ([Documentation](https://docs.platformio.org/en/stable/projectconf/index.html))
- `README.md`: This file

# Team Members
- [Yikun](https://github.com/PorridgePi)
- [Zachary](https://github.com/Zachareeeeee)
