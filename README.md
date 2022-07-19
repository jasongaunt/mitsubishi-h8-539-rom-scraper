# Mitsubishi H8/539 ROM Scraper

### Purpose
This NodeJS application will scour the supplied ROM (well, technically EEPROM) image and print out what it finds. This tool is known to work with ROM dumps from the Hitatchi H8/539 based chips (of precisely 131,072 bytes aka 128 KB), although your mileage (geddit?) may vary.

I have successfully tested it on images taken from Mitsubishi ECU's with IC's stamped...

* Hitachi H8/539F
* Mitsubishi MH7202F
* Mitsubishi MH7203FA

... from the following cars where the above ECUs were fitted:

* 8th gen Mitsubishi Legnum / Galant (Any 6a13 based variant, NA or Twin Turbo)
* 2nd gen Mitsubishi Pajero / Shogun (6g74 SOHC Non-GDI)
* Mitsubishi FTO (Any 6a13 based variant)

If you observe this working on another model, please let me know 👍

### Usage
To use this tool, you will need the following:

* NodeJS installed on a Linux or BSD-based operating system (this tool was written a while ago with v12.22.10)
* A terminal capable of 24-bit colour ([PuTTY](https://www.putty.org/) on Windows happily supports this, as does [iTerm2](https://iterm2.com/) on Mac OS)

Once you have the above and have installed the dependencies, usage is as follows;

```shell
node index.js /path/to/rom/image.bin
```

### Reading the output

All output is colour highlighted sweeping across the RGB spectrum to visually convey change. It makes identifying particular tables (such as the fuel or ignition timing tables) quite easy to spot.

Assuming the tool could parse the ROM image you passed to it, you should see something akin to the following;

![Screenshot showing MUT table](/assets/screenshot-1.png?raw=true "Screenshot showing MUT table")

At the very top you should see the MUT request table. This should be a table of 16-bit Hexadecimal values typically starting with `Fxxx` but occasionally `Exxx` as well.

Next up is are the found tables. These are listed in the following format...

| Hex Address | Header | 8 chars before | Header  | Colourised Table  |
| ------------ | ------------ | ------------ | ------------ | ------------ |
| 0x1C900 | F0 AA F1 56 00 0C | FFFFFFFFFFFFFFFF | F0AAF156000C | 00C001000140018001C00200028003000400050006000700 |

... and are presented as follows:

![Screenshot showing scaling tables](/assets/screenshot-2.png?raw=true "Screenshot showing scaling tables")

Finally we have the 1D, 2D and 3D (value) tables. These all reference at least one scaling table and contain values such as fuelling and ignition timing tables.

![Screenshot showing 1D, 2D and 3D tables](/assets/screenshot-3.png?raw=true "Screenshot showing 1D, 2D and 3D tables")

### Understanding the output
Good luck with that! I'll update this section later 😁

### Disclaimer
This code was written from scratch by reverse engineering ROM images using a hex editor. No external references were made nor any copyrighted material utilised.

There is strictly no warranty implied, all of this code is for educational purposes only and if you break something, it's not my fault.

This code is protected by the GPLv3 license, please see the attached LICENSE file for more info. You may not use this code for commercial gain and if you make any improvements please share them back with the community for free.