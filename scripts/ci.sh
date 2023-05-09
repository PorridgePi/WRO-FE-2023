#!/usr/bin/env bash

sections=`grep "^\[" platformio.ini | sort -u | xargs | tr '\[' ' ' | tr '\]' ' ' `
for section in $sections; do
    if [[ "$section" == "env:"* ]]; then
        correct_section=${section:4} # remove the "env:" prefix
        echo "Building $correct_section"
        pio run -e $correct_section
        if [ $? -ne 0 ]; then
            exit 1
        fi
    fi
done
