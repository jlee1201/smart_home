# Denon AVR-X4500H Command Reference

This document provides a comprehensive list of Telnet commands for controlling the Denon AVR-X4500H via the network.

## Connection Details

- **Protocol**: Telnet
- **Port**: 23
- **Default IP**: 192.168.50.98 (configured in your environment)

## Command Format

Commands are sent as plain text over Telnet with a carriage return (`\r`) at the end. Responses are typically received immediately.

## Basic Commands

### Power Control

| Command    | Description          | Response Example |
|------------|----------------------|------------------|
| `PW?`      | Get power status     | `PWON` or `PWSTANDBY` |
| `PWON`     | Power on             | `PWON` |
| `PWSTANDBY`| Power off (standby)  | `PWSTANDBY` |

### Volume Control

| Command    | Description           | Response Example |
|------------|-----------------------|------------------|
| `MV?`      | Get volume level      | `MV50` (volume at 50/99) |
| `MVUP`     | Volume up             | `MV51` |
| `MVDOWN`   | Volume down           | `MV49` |
| `MV50`     | Set volume to 50      | `MV50` |

Volume ranges from 00 to 99, with 99 being the maximum volume (0-100%).

### Mute Control

| Command    | Description           | Response Example |
|------------|-----------------------|------------------|
| `MU?`      | Get mute status       | `MUON` or `MUOFF` |
| `MUON`     | Mute on               | `MUON` |
| `MUOFF`    | Mute off              | `MUOFF` |

### Input Selection

| Command      | Description           | Response Example |
|--------------|-----------------------|------------------|
| `SI?`        | Get current input     | `SITV` |
| `SICBL/SAT`  | Set input to CBL/SAT  | `SICBL/SAT` |
| `SIDVD`      | Set input to DVD      | `SIDVD` |
| `SIBD`       | Set input to Blu-ray  | `SIBD` |
| `SIGAME`     | Set input to Game     | `SIGAME` |
| `SIAUX1`     | Set input to AUX1     | `SIAUX1` |
| `SIMPLAY`    | Set input to Media Player | `SIMPLAY` |
| `SITV`       | Set input to TV       | `SITV` |
| `SITUNER`    | Set input to Tuner    | `SITUNER` |
| `SIPHONO`    | Set input to Phono    | `SIPHONO` |
| `SICD`       | Set input to CD       | `SICD` |
| `SIBT`       | Set input to Bluetooth| `SIBT` |
| `SINET`      | Set input to Network  | `SINET` |

### Sound Modes

| Command      | Description           | Response Example |
|--------------|-----------------------|------------------|
| `MS?`        | Get current sound mode| `MSDIRECT` |
| `MSMOVIE`    | Movie sound mode      | `MSMOVIE` |
| `MSMUSIC`    | Music sound mode      | `MSMUSIC` |
| `MSGAME`     | Game sound mode       | `MSGAME` |
| `MSDIRECT`   | Direct sound mode     | `MSDIRECT` |
| `MSSTEREO`   | Stereo sound mode     | `MSSTEREO` |
| `MSAUTO`     | Auto sound mode       | `MSAUTO` |
| `MSDOLBY`    | Dolby sound mode      | `MSDOLBY` |
| `MSDTS`      | DTS sound mode        | `MSDTS` |
| `MSMULTI`    | Multi-channel stereo  | `MSMULTI` |

## Advanced Commands

### Zone 2 Control

| Command      | Description             | Response Example |
|--------------|-------------------------|------------------|
| `Z2?`        | Get Zone 2 power status | `Z2ON` or `Z2OFF` |
| `Z2ON`       | Power on Zone 2         | `Z2ON` |
| `Z2OFF`      | Power off Zone 2        | `Z2OFF` |
| `Z2?`        | Get Zone 2 volume       | `Z230` |
| `Z220`       | Set Zone 2 volume to 20 | `Z220` |
| `Z2UP`       | Zone 2 volume up        | `Z231` |
| `Z2DOWN`     | Zone 2 volume down      | `Z229` |
| `Z2MU?`      | Get Zone 2 mute status  | `Z2MUON` or `Z2MUOFF` |
| `Z2MUON`     | Mute Zone 2             | `Z2MUON` |
| `Z2MUOFF`    | Unmute Zone 2           | `Z2MUOFF` |

### On-Screen Menu Navigation

| Command      | Description             | Response Example |
|--------------|-------------------------|------------------|
| `MNMEN`      | Menu                    | `MNMEN` |
| `MNCUP`      | Cursor Up               | `MNCUP` |
| `MNCDN`      | Cursor Down             | `MNCDN` |
| `MNCLT`      | Cursor Left             | `MNCLT` |
| `MNCRT`      | Cursor Right            | `MNCRT` |
| `MNENT`      | Enter/Select            | `MNENT` |
| `MNRTN`      | Return                  | `MNRTN` |
| `MN`         | Home                    | `MN` |
| `MNOPT`      | Option                  | `MNOPT` |
| `MNINF`      | Info                    | `MNINF` |

### Playback Controls

| Command      | Description             | Response Example |
|--------------|-------------------------|------------------|
| `NS9A`       | Play                    | `NS9A` |
| `NS9B`       | Pause                   | `NS9B` |
| `NS9C`       | Stop                    | `NS9C` |
| `NS9E`       | Previous                | `NS9E` |
| `NS9D`       | Next                    | `NS9D` |
| `NS9F`       | Fast Forward            | `NS9F` |
| `NS9G`       | Rewind                  | `NS9G` |

### ECO Mode

| Command      | Description             | Response Example |
|--------------|-------------------------|------------------|
| `ECO?`       | Get ECO mode status     | `ECOAUTO`, `ECOON`, or `ECOOFF` |
| `ECOAUTO`    | ECO mode Auto           | `ECOAUTO` |
| `ECOON`      | ECO mode On             | `ECOON` |
| `ECOOFF`     | ECO mode Off            | `ECOOFF` |

### Sleep Timer

| Command      | Description              | Response Example |
|--------------|--------------------------|------------------|
| `SLP?`       | Get sleep timer status   | `SLPOFF` or `SLP030` |
| `SLPOFF`     | Sleep timer off          | `SLPOFF` |
| `SLP030`     | Sleep timer 30 minutes   | `SLP030` |
| `SLP060`     | Sleep timer 60 minutes   | `SLP060` |
| `SLP090`     | Sleep timer 90 minutes   | `SLP090` |
| `SLP120`     | Sleep timer 120 minutes  | `SLP120` |

### Quick Select

| Command      | Description             | Response Example |
|--------------|-------------------------|------------------|
| `MSQUICK1`   | Quick Select 1          | `MSQUICK1` |
| `MSQUICK2`   | Quick Select 2          | `MSQUICK2` |
| `MSQUICK3`   | Quick Select 3          | `MSQUICK3` |
| `MSQUICK4`   | Quick Select 4          | `MSQUICK4` |
| `MSQUICK5`   | Quick Select 5          | `MSQUICK5` |

### Audyssey Settings

| Command          | Description              | Response Example |
|------------------|--------------------------|------------------|
| `PSMULTEQ:?`     | Get MultEQ status        | `PSMULTEQ:ON` or `PSMULTEQ:OFF` |
| `PSMULTEQ:ON`    | MultEQ On                | `PSMULTEQ:ON` |
| `PSMULTEQ:OFF`   | MultEQ Off               | `PSMULTEQ:OFF` |
| `PSDYNEQ:?`      | Get Dynamic EQ status    | `PSDYNEQ:ON` or `PSDYNEQ:OFF` |
| `PSDYNEQ:ON`     | Dynamic EQ On            | `PSDYNEQ:ON` |
| `PSDYNEQ:OFF`    | Dynamic EQ Off           | `PSDYNEQ:OFF` |
| `PSDYNVOL:?`     | Get Dynamic Volume status| `PSDYNVOL:HEV`, `PSDYNVOL:MED`, `PSDYNVOL:LIT`, or `PSDYNVOL:OFF` |
| `PSDYNVOL:HEV`   | Dynamic Volume Heavy     | `PSDYNVOL:HEV` |
| `PSDYNVOL:MED`   | Dynamic Volume Medium    | `PSDYNVOL:MED` |
| `PSDYNVOL:LIT`   | Dynamic Volume Light     | `PSDYNVOL:LIT` |
| `PSDYNVOL:OFF`   | Dynamic Volume Off       | `PSDYNVOL:OFF` |

## Troubleshooting

If you're having issues with the Telnet connection:

1. Ensure the AVR is powered on and connected to the network
2. Verify the IP address is correct (check your router or the AVR's network settings)
3. Try using the `nc` (netcat) command to test the connection:
   ```
   echo "PW?" | nc 192.168.50.98 23
   ```
4. Make sure no firewall is blocking port 23 (Telnet)

## References

- [Denon AVR Control Protocol](https://usa.denon.com/us/product/hometheater/receivers/avrx4500h)
- [Unofficial Denon Protocol Documentation](https://github.com/scarface-4711/denonavr)
- [Home Assistant Denon Integration](https://www.home-assistant.io/integrations/denonavr/) 