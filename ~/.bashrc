# Simple bash configuration optimized for cursor agent
export PS1='$ '
export PS2='> '

# Disable pagers that can cause hanging
export PAGER="cat"
export GIT_PAGER="cat" 
export MANPAGER="cat"
export DOCKER_CLI_HINTS="false"

# Load mise if available (for consistent environment)
if command -v mise &> /dev/null; then
    eval "$(mise activate bash --shims)"
fi

# Basic aliases for development
alias ll='ls -la'
alias la='ls -A'
alias l='ls -CF'

# Load profile if it exists
if [ -f ~/.profile ]; then
    source ~/.profile
fi 