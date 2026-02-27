#!/bin/bash

cd /home/frappe/project_management/CPMTS

# Load Node environment if using nvm (optional)
# export NVM_DIR="$HOME/.nvm"
# [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

npm run dev -- --host 0.0.0.0 --port  12001
