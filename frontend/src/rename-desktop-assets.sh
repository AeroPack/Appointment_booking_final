#!/bin/bash
# rename-desktop-assets.sh
# Run from: frontend/src/ (where features/ folder lives)

set -e  # stop on error

echo "Searching for desktop_* folders inside features/*/stitch and components/stitch..."

# Find all directories named "desktop_*" under any stitch folder
find features/*/stitch components/stitch -type d -name "desktop_*" 2>/dev/null | while read -r dir; do
    echo "Processing: $dir"
    
    # Rename code.html -> desktop_code.html if exists
    if [ -f "$dir/code.html" ]; then
        mv "$dir/code.html" "$dir/desktop_code.html"
        echo "  Renamed code.html -> desktop_code.html"
    fi
    
    # Rename screen.png -> desktop_screen.png if exists
    if [ -f "$dir/screen.png" ]; then
        mv "$dir/screen.png" "$dir/desktop_screen.png"
        echo "  Renamed screen.png -> desktop_screen.png"
    fi
done

echo "Done! Mobile folders still have code.html and screen.png."
echo "Desktop folders now have desktop_code.html and desktop_screen.png."