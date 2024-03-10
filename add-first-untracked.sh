#!/bin/bash

# Find the first changed file using git status
first_changed_file=$(git status --porcelain | awk '{print $2}' | head -n 1)

# Check if a file was found
if [ -z "$first_changed_file" ]; then
    echo "No changed files found."
    exit 1
fi

# Add the first changed file to staging
git add "$first_changed_file"

