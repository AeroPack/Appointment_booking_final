#!/bin/bash
# reorganize-stitch.sh
# Run from: frontend/src/

set -e  # exit on error

STITCH_SRC="features/stitch_markdown_design_system"
# If the folder is actually named "stitch_markdown_design_system" as shown in your tree

# Check if source exists
if [ ! -d "$STITCH_SRC" ]; then
    echo "Error: $STITCH_SRC not found. Are you in the right directory?"
    exit 1
fi

# Create target stitch directories inside each feature
mkdir -p features/auth/stitch
mkdir -p features/dashboard/stitch
mkdir -p features/appointments/stitch
mkdir -p features/profile/stitch
mkdir -p components/stitch

# Move function: move folder if exists
move_folder() {
    local folder=$1
    local target=$2
    if [ -d "$STITCH_SRC/$folder" ]; then
        echo "Moving $folder -> $target"
        mv "$STITCH_SRC/$folder" "$target"
    else
        echo "Warning: $folder not found, skipping"
    fi
}

# === AUTH ===
move_folder "mobile_login" "features/auth/stitch/"
move_folder "desktop_login" "features/auth/stitch/"
move_folder "otp_verification" "features/auth/stitch/"
move_folder "desktop_otp_verification" "features/auth/stitch/"

# === DASHBOARD ===
move_folder "patient_dashboard" "features/dashboard/stitch/"
move_folder "desktop_patient_dashboard" "features/dashboard/stitch/"

# === APPOINTMENTS ===
move_folder "doctor_details" "features/appointments/stitch/"
move_folder "desktop_doctor_details" "features/appointments/stitch/"
move_folder "choose_a_time" "features/appointments/stitch/"
move_folder "desktop_choose_a_time" "features/appointments/stitch/"
move_folder "confirm_booking" "features/appointments/stitch/"
move_folder "desktop_confirm_booking" "features/appointments/stitch/"
move_folder "booking_success" "features/appointments/stitch/"
move_folder "desktop_booking_success" "features/appointments/stitch/"
move_folder "my_appointments" "features/appointments/stitch/"
move_folder "desktop_my_appointments" "features/appointments/stitch/"
move_folder "appointment_detail" "features/appointments/stitch/"
move_folder "desktop_appointment_detail" "features/appointments/stitch/"

# === PROFILE ===
move_folder "patient_profile_settings" "features/profile/stitch/"
move_folder "desktop_patient_profile_settings" "features/profile/stitch/"
move_folder "family_members" "features/profile/stitch/"
move_folder "desktop_family_members" "features/profile/stitch/"
move_folder "account_picker" "features/profile/stitch/"
move_folder "desktop_account_picker" "features/profile/stitch/"

# === STANDALONE LOGO ===
move_folder "serene_health_logo" "components/stitch/"

# === DESIGN.md — copy to project root docs (optional) ===
if [ -f "$STITCH_SRC/serene_health/DESIGN.md" ]; then
    echo "Copying DESIGN.md to project root"
    mkdir -p ../docs  # assuming docs/ at project root (one level up from src)
    cp "$STITCH_SRC/serene_health/DESIGN.md" ../docs/DESIGN.md
    # also keep a copy in each feature? Not needed; just reference.
fi

# Remove empty directories left behind
rmdir "$STITCH_SRC" 2>/dev/null || echo "Stitch source directory not empty (maybe some files remain) - please check manually"

echo "Done! Stitch folders have been moved into feature/stitch subdirectories."
echo ""
echo "New structure example:"
echo "  features/auth/stitch/mobile_login/code.html"
echo "  features/auth/stitch/desktop_login/screen.png"
echo "  components/stitch/serene_health_logo/"