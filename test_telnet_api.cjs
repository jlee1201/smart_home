const net = require('net');

// Simplified version of the DenonTelnetAPI for testing
class DenonTelnetAPI {
  constructor(config) {
    this.ip = config.ip;
    this.port = config.port || 23;
    this.connectionTimeout = config.connectionTimeout || 5000;
    this.commandTimeout = config.commandTimeout || 3000;
  }

  async sendCommand(command) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        if (this.client) {
          this.client.destroy();
          this.client = null;
        }
        resolve({
          success: false,
          data: '',
          error: 'Connection timeout'
        });
      }, this.commandTimeout);
      
      let responseData = '';
      
      try {
        this.client = new net.Socket();
        
        this.client.on('data', (data) => {
          responseData += data.toString();
        });
        
        this.client.on('close', () => {
          clearTimeout(timeoutId);
          console.log(`Raw response: "${responseData.trim()}"`);
          resolve({
            success: true,
            data: responseData.trim()
          });
        });
        
        this.client.on('error', (error) => {
          clearTimeout(timeoutId);
          console.error('Error communicating with Denon AVR via Telnet', error);
          
          if (this.client) {
            this.client.destroy();
            this.client = null;
          }
          
          resolve({
            success: false,
            data: '',
            error: error.message
          });
        });
        
        this.client.connect(this.port, this.ip, () => {
          console.log(`Connected to ${this.ip}:${this.port}, sending command: ${command}`);
          this.client.write(`${command}\r`);
          
          setTimeout(() => {
            if (this.client) {
              this.client.end();
            }
          }, 1000);
        });
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Error in Telnet connection to Denon AVR', error);
        
        if (this.client) {
          this.client.destroy();
          this.client = null;
        }
        
        resolve({
          success: false,
          data: '',
          error: error.message
        });
      }
    });
  }

  async getPowerState() {
    try {
      const response = await this.sendCommand('PW?');
      return response.success && response.data.includes('PWON');
    } catch (error) {
      console.error('Error getting Denon AVR power state via Telnet', error);
      return false;
    }
  }

  async getVolume() {
    try {
      const response = await this.sendCommand('MV?');
      
      if (response.success) {
        const volumeMatch = response.data.match(/MV(\d+)/);
        if (volumeMatch && volumeMatch[1]) {
          const volumeValue = parseInt(volumeMatch[1], 10);
          return Math.round((volumeValue / 99) * 100);
        }
      }
      
      return 0;
    } catch (error) {
      console.error('Error getting Denon AVR volume via Telnet', error);
      return 0;
    }
  }

  async getMuteState() {
    try {
      const response = await this.sendCommand('MU?');
      return response.success && response.data.includes('MUON');
    } catch (error) {
      console.error('Error getting Denon AVR mute state via Telnet', error);
      return false;
    }
  }

  async getCurrentInput() {
    try {
      const response = await this.sendCommand('SI?');
      
      if (response.success) {
        const inputMatch = response.data.match(/SI(.+)/);
        if (inputMatch && inputMatch[1]) {
          return inputMatch[1];
        }
      }
      
      return '';
    } catch (error) {
      console.error('Error getting Denon AVR input via Telnet', error);
      return '';
    }
  }

  async getSoundMode() {
    try {
      const response = await this.sendCommand('MS?');
      
      if (response.success) {
        const modeMatch = response.data.match(/MS(.+)/);
        if (modeMatch && modeMatch[1]) {
          return modeMatch[1];
        }
      }
      
      return '';
    } catch (error) {
      console.error('Error getting Denon AVR sound mode via Telnet', error);
      return '';
    }
  }
}

// Create API instance
const denonApi = new DenonTelnetAPI({
  ip: '192.168.50.98',
  port: 23,
  connectionTimeout: 5000,
  commandTimeout: 3000
});

// Test function
async function testDenonApi() {
  console.log('Testing Denon AVR Telnet API...');
  
  try {
    // Test connection and get power state
    console.log('Getting power state...');
    const isPowered = await denonApi.getPowerState();
    console.log(`Power state: ${isPowered ? 'ON' : 'OFF'}`);
    
    // Test getting volume
    console.log('Getting volume...');
    const volume = await denonApi.getVolume();
    console.log(`Volume: ${volume}%`);
    
    // Test getting mute state
    console.log('Getting mute state...');
    const isMuted = await denonApi.getMuteState();
    console.log(`Mute state: ${isMuted ? 'MUTED' : 'NOT MUTED'}`);
    
    // Test getting current input
    console.log('Getting current input...');
    const input = await denonApi.getCurrentInput();
    console.log(`Current input: ${input}`);
    
    // Test getting sound mode
    console.log('Getting sound mode...');
    const soundMode = await denonApi.getSoundMode();
    console.log(`Sound mode: ${soundMode}`);
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testDenonApi(); 