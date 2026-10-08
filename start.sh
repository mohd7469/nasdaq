sudo find . -mindepth 1 -maxdepth 1 -exec rm -rf {} +
sudo killall -9 Xvfb x11vnc websockify google-chrome xfce4-session openbox dbus-daemon 2>/dev/null

cat << 'EOF' > script.sh
#!/bin/bash
echo "=== Step 1: Cleaning Old Packages & Cache ==="
export DEBIAN_FRONTEND=noninteractive
sudo DEBIAN_FRONTEND=noninteractive apt purge -y dbus-x11 xfce4* openbox xvfb x11vnc websockify novnc google-chrome-stable 2>/dev/null
sudo apt autoremove -y --purge 2>/dev/null
sudo apt clean 2>/dev/null
rm -rf ~/.config ~/.cache ~/.vnc ~/.local 2>/dev/null

echo "=== Step 2: Updating & Upgrading System Packages ==="
sudo apt update && sudo apt upgrade -y && sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"

echo "=== Step 3: Fresh Installation & Auto Keyboard Selection ==="
sudo apt install -y debconf-utils
echo "keyboard-configuration keyboard-configuration/layoutcode string us" | sudo debconf-set-selections
echo "keyboard-configuration keyboard-configuration/modelcode string pc105" | sudo debconf-set-selections

sudo DEBIAN_FRONTEND=noninteractive apt install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" dbus-x11 xfce4-session openbox xvfb x11vnc websockify novnc wget xdg-user-dirs

if ! command -v google-chrome &> /dev/null; then
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    sudo DEBIAN_FRONTEND=noninteractive apt install -y ./google-chrome-stable_current_amd64.deb
    rm -f google-chrome-stable_current_amd64.deb
fi

# Yahan default directories ko dobara generate karne ke liye add kiya hai:
xdg-user-dirs-update

echo "=== Step 4: Starting Environment ==="
killall -9 Xvfb x11vnc websockify google-chrome xfce4-session 2>/dev/null
eval $(dbus-launch --sh-syntax)
Xvfb :1 -screen 0 1920x1080x24 &
sleep 2
DISPLAY=:1 dbus-run-session xfce4-session &
sleep 1
x11vnc -display :1 -nopw -forever -shared &
websockify --web /usr/share/novnc 6080 localhost:6080 &
sleep 3
DISPLAY=:1 google-chrome --no-sandbox --start-maximized https://tradingview.com/chart &

echo "=== Starting Keep-Alive Loop ==="
touch keep_alive.log
echo "[$(date)] Keep-alive loop initialized." >> keep_alive.log
while true; do 
    echo "[$(date)] Keep-alive ping active..." >> keep_alive.log
    sleep 300 
done &

echo "=== SETUP COMPLETE! PORT 6080 OPEN KAREIN ==="

EOF

chmod +x script.sh && ./script.sh

# Script run hone ke baad foran live logs show karne ke liye:
tail -f keep_alive.log