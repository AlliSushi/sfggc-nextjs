#!/bin/bash

# SFGGC Website SSH Key Setup Script
# This script helps set up SSH keys for passwordless deployment

echo "🔑 SFGGC SSH Key Setup"
echo "===================="
echo ""

# Check if required information is provided
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "❌ Usage: ./deploy_scripts/setup-ssh.sh <ssh_user@server> <server_alias>"
    echo ""
    echo "Example:"
    echo "  ./deploy_scripts/setup-ssh.sh jfuggc@54.70.1.215 sfggc-server"
    echo ""
    echo "Where:"
    echo "  - ssh_user@server: Your SSH connection string"
    echo "  - server_alias: A friendly name for your SSH config (e.g., sfggc-server)"
    echo ""
    exit 1
fi

SSH_CONNECTION="$1"
SERVER_ALIAS="$2"
SSH_USER=$(echo "$SSH_CONNECTION" | cut -d'@' -f1)
SSH_HOST=$(echo "$SSH_CONNECTION" | cut -d'@' -f2)

echo "📋 SSH Setup Configuration:"
echo "  SSH Connection: $SSH_CONNECTION"
echo "  Server Alias: $SERVER_ALIAS"
echo "  SSH User: $SSH_USER"
echo "  SSH Host: $SSH_HOST"
echo ""

# Create .ssh directory if it doesn't exist
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Generate SSH key if it doesn't exist
KEY_NAME="id_ed25519_${SERVER_ALIAS}"
KEY_PATH="$HOME/.ssh/$KEY_NAME"

if [ -f "$KEY_PATH" ]; then
    echo "⚠️  SSH key already exists: $KEY_PATH"
    read -p "Do you want to generate a new key? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Using existing key: $KEY_PATH"
    else
        echo "🔑 Generating new SSH key..."
        ssh-keygen -t ed25519 -C "sfggc-deployment-${SERVER_ALIAS}" -f "$KEY_PATH" -N ""
        echo "✅ SSH key generated: $KEY_PATH"
    fi
else
    echo "🔑 Generating SSH key..."
    ssh-keygen -t ed25519 -C "sfggc-deployment-${SERVER_ALIAS}" -f "$KEY_PATH" -N ""
    echo "✅ SSH key generated: $KEY_PATH"
fi

# Display public key
echo ""
echo "📋 Your public key:"
echo "==================="
cat "${KEY_PATH}.pub"
echo ""
echo "==================="
echo ""

# Update SSH config
SSH_CONFIG="$HOME/.ssh/config"
CONFIG_ENTRY="Host $SERVER_ALIAS
    HostName $SSH_HOST
    User $SSH_USER
    IdentityFile \"$KEY_PATH\"
    IdentitiesOnly yes
"

echo "📝 Updating SSH config..."

# Check if entry already exists
if grep -q "Host $SERVER_ALIAS" "$SSH_CONFIG" 2>/dev/null; then
    echo "⚠️  SSH config entry for '$SERVER_ALIAS' already exists."
    read -p "Do you want to replace it? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Remove old entry
        sed -i.bak "/^Host $SERVER_ALIAS$/,/^$/d" "$SSH_CONFIG" 2>/dev/null || \
        sed -i '' "/^Host $SERVER_ALIAS$/,/^$/d" "$SSH_CONFIG" 2>/dev/null
        # Add new entry
        echo "" >> "$SSH_CONFIG"
        echo "$CONFIG_ENTRY" >> "$SSH_CONFIG"
        echo "✅ SSH config updated"
    else
        echo "Keeping existing SSH config entry"
    fi
else
    # Add new entry
    echo "" >> "$SSH_CONFIG"
    echo "$CONFIG_ENTRY" >> "$SSH_CONFIG"
    echo "✅ SSH config updated"
fi

chmod 600 "$SSH_CONFIG"

echo ""
echo "📤 Adding SSH key to server..."
echo "You will be prompted for your password once to add the key to the server."
echo ""

# Try to add the key to the server
PUBLIC_KEY=$(cat "${KEY_PATH}.pub")

# Method 1: Try ssh-copy-id
if command -v ssh-copy-id &> /dev/null; then
    echo "Attempting to add key using ssh-copy-id..."
    ssh-copy-id -i "${KEY_PATH}.pub" "$SSH_CONNECTION" 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Key added to server successfully!"
    else
        echo "⚠️  ssh-copy-id failed. Trying manual method..."
        MANUAL_METHOD=true
    fi
else
    MANUAL_METHOD=true
fi

# Method 2: Manual method
if [ "$MANUAL_METHOD" = true ]; then
    echo ""
    echo "Please run this command manually (it will prompt for your password):"
    echo ""
    echo "ssh $SSH_CONNECTION 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo \"$PUBLIC_KEY\" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'"
    echo ""
    read -p "Have you added the key to the server? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "⚠️  Please add the key manually before proceeding."
        echo "   Run the command shown above, then test with: ssh $SERVER_ALIAS 'echo Connection successful'"
        exit 1
    fi
fi

# Test SSH connection
echo ""
echo "🧪 Testing SSH connection..."
if ssh -o ConnectTimeout=5 -o BatchMode=yes "$SERVER_ALIAS" "echo 'Connection successful'" 2>/dev/null; then
    echo "✅ Passwordless SSH connection works!"
    echo ""
    echo "🎉 SSH setup complete!"
    echo ""
    echo "You can now deploy using:"
    echo "  ./deploy_scripts/deploy.sh $SERVER_ALIAS <domain_path> <domain_name>"
    echo ""
else
    echo "⚠️  Passwordless connection test failed."
    echo "   Please verify that the key was added to the server."
    echo "   Test manually with: ssh $SERVER_ALIAS 'echo Connection successful'"
    echo ""
    exit 1
fi

