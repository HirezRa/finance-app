#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get upgrade -y
apt-get install -y \
  curl wget git nano htop sudo ca-certificates gnupg lsb-release unzip \
  build-essential openssl

timedatectl set-timezone Asia/Jerusalem || true

if ! id -u finance &>/dev/null; then
  useradd -m -s /bin/bash finance
  echo "finance:$(openssl rand -base64 16)" | chpasswd
  usermod -aG sudo finance
fi

apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
install -m 0755 -d /etc/apt/keyrings
curl -fsSL --max-time 30 --connect-timeout 10 https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker
usermod -aG docker finance 2>/dev/null || true

curl -fsSL --max-time 30 --connect-timeout 10 https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pnpm || true

echo "OS + Docker + Node done."
