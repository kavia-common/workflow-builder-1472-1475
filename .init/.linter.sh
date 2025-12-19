#!/bin/bash
cd /home/kavia/workspace/code-generation/workflow-builder-1472-1475/workflow_designer_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

