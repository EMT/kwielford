// 'roboface' example sketch for Adafruit I2C 8x8 LED backpacks:
//
//  www.adafruit.com/products/870   www.adafruit.com/products/1049
//  www.adafruit.com/products/871   www.adafruit.com/products/1050
//  www.adafruit.com/products/872   www.adafruit.com/products/1051
//  www.adafruit.com/products/959   www.adafruit.com/products/1052
//
// Requires Adafruit_LEDBackpack and Adafruit_GFX libraries.
// For a simpler introduction, see the 'matrix8x8' example.
//
// This sketch demonstrates a couple of useful techniques:
// 1) Addressing multiple matrices (using the 'A0' and 'A1' solder
//    pads on the back to select unique I2C addresses for each).
// 2) Displaying the same data on multiple matrices by sharing the
//    same I2C address.
//
// This example uses 5 matrices at 4 addresses (two share an address)
// to animate a face:
//
//     0     0
//
//      1 2 3
//
// The 'eyes' both display the same image (always looking the same
// direction -- can't go cross-eyed) and thus share the same address
// (0x70).  The three matrices forming the mouth have unique addresses
// (0x71, 0x72 and 0x73).
//
// The face animation as written is here semi-random; this neither
// generates nor responds to actual sound, it's simply a visual effect
// Consider this a stepping off point for your own project.  Maybe you
// could 'puppet' the face using joysticks, or synchronize the lips to
// audio from a Wave Shield (see wavface example).  Currently there are
// only six images for the mouth.  This is often sufficient for simple
// animation, as explained here:
// http://www.idleworm.com/how/anm/03t/talk1.shtml
//
// Adafruit invests time and resources providing this open source code,
// please support Adafruit and open-source hardware by purchasing
// products from Adafruit!
//
// Written by P. Burgess for Adafruit Industries.
// BSD license, all text above must be included in any redistribution.

#include <Arduino.h>
#include <Wire.h>
#include "Adafruit_LEDBackpack.h"
#include "Adafruit_GFX.h"



#include <SPI.h>
#include <Ethernet.h>
#include <SD.h>
#include <EEPROM.h>

#include <Timer.h>

Timer t;


byte mac[] = { 0x00, 0xAA, 0xBB, 0xCC, 0xDA, 0x02 }; // physical mac address

// The printerType controls the format of the data sent from the server
// If you're using a completely different kind of printer, change this
// to correspond to your printer's PrintProcessor implementation in the
// server.
//
// If you want to control the darkness of your printouts, append a dot and
// a number, e.g. A2-raw.240 (up to a maximum of 255).
//
// If you want to flip the vertical orientation of your printouts, append
// a number and then .flipped, e.g. A2-raw.240.flipped
const char printerType[] = "A2-raw";

const char host[] = "printer.exciting.io"; // the host of the backend server
const unsigned int port = 80;

const unsigned long pollingDelay = 10000; // delay between polling requests (milliseconds)

const byte printer_TX_Pin = 9; // this is the yellow wire
const byte printer_RX_Pin = 8; // this is the green wire
const byte errorLED = 7;       // the red LED
const byte downloadLED = 6;    // the amber LED
const byte readyLED = 5;       // the green LED
const byte buttonPin = 3;      // the print button
const byte SD_Pin = 4;         // the SD Card SPI pin

// #define DEBUG // When debug is enabled, log a bunch of stuff to the hardware Serial

// -- Everything below here can be left alone

const char sketchVersion[] = "1.0.6";


// -- Check for new data and download if found

boolean downloadWaiting = false;
char cacheFilename[] = "TMP";
unsigned long content_length = 0;
boolean statusOk = false;

#include <SoftwareSerial.h>
//#include <Bounce2.h>


// Because the two eye matrices share the same address, only four
// matrix objects are needed for the five displays:
#define MATRIX_EYES         0
#define MATRIX_MOUTH_LEFT   1
#define MATRIX_MOUTH_MIDDLE 2
#define MATRIX_MOUTH_RIGHT  3
Adafruit_8x8matrix matrix[4] = { // Array of Adafruit_8x8matrix objects
  Adafruit_8x8matrix(), Adafruit_8x8matrix(),
  Adafruit_8x8matrix(), Adafruit_8x8matrix() };

// Rather than assigning matrix addresses sequentially in a loop, each
// has a spot in this array.  This makes it easier if you inadvertently
// install one or more matrices in the wrong physical position --
// re-order the addresses in this table and you can still refer to
// matrices by index above, no other code or wiring needs to change.
static const uint8_t matrixAddr[] = { 0x70, 0x71, 0x72, 0x73 };

static const uint8_t PROGMEM // Bitmaps are stored in program memory
  blinkImg[][8] = {    // Eye animation frames
  { B00111100,         // Fully open eye
    B01111110,
    B11111111,
    B11111111,
    B11111111,
    B11111111,
    B01111110,
    B00111100 },
  { B00000000,
    B01111110,
    B11111111,
    B11111111,
    B11111111,
    B11111111,
    B01111110,
    B00111100 },
  { B00000000,
    B00000000,
    B00111100,
    B11111111,
    B11111111,
    B11111111,
    B00111100,
    B00000000 },
  { B00000000,
    B00000000,
    B00000000,
    B00111100,
    B11111111,
    B01111110,
    B00011000,
    B00000000 },
  { B00000000,         // Fully closed eye
    B00000000,
    B00000000,
    B00000000,
    B10000001,
    B01111110,
    B00000000,
    B00000000 } },
  mouthImg[][24] = {                 // Mouth animation frames
  { B00000000, B00000000, B00000000, // Mouth position A
    B00000000, B00000000, B00000000,
    B01111111, B11111111, B11111110,
    B00000000, B00000000, B00000000,
    B00000000, B00000000, B00000000,
    B00000000, B00000000, B00000000,
    B00000000, B00000000, B00000000,
    B00000000, B00000000, B00000000 },
  { B00000000, B00000000, B00000000, // Mouth position B
    B00000000, B00000000, B00000000,
    B00111111, B11111111, B11111100,
    B00000111, B00000000, B11100000,
    B00000000, B11111111, B00000000,
    B00000000, B00000000, B00000000,
    B00000000, B00000000, B00000000,
    B00000000, B00000000, B00000000 },
  { B00000000, B00000000, B00000000, // Mouth position C
    B00000000, B00000000, B00000000,
    B00111111, B11111111, B11111100,
    B00001000, B00000000, B00010000,
    B00000110, B00000000, B01100000,
    B00000001, B11000011, B10000000,
    B00000000, B00111100, B00000000,
    B00000000, B00000000, B00000000 },
  { B00000000, B00000000, B00000000, // Mouth position D
    B00000000, B00000000, B00000000,
    B00111111, B11111111, B11111100,
    B00100000, B00000000, B00000100,
    B00010000, B00000000, B00001000,
    B00001100, B00000000, B00110000,
    B00000011, B10000001, B11000000,
    B00000000, B01111110, B00000000 },
  { B00000000, B00000000, B00000000, // Mouth position E
    B00000000, B00111100, B00000000,
    B00011111, B11000011, B11111000,
    B00000011, B10000001, B11000000,
    B00000000, B01111110, B00000000,
    B00000000, B00000000, B00000000,
    B00000000, B00000000, B00000000,
    B00000000, B00000000, B00000000 },
  { B00000000, B00111100, B00000000, // Mouth position F
    B00000000, B11000011, B00000000,
    B00001111, B00000000, B11110000,
    B00000001, B00000000, B10000000,
    B00000000, B11000011, B00000000,
    B00000000, B00111100, B00000000,
    B00000000, B00000000, B00000000,
    B00000000, B00000000, B00000000 } };

uint8_t
  blinkIndex[] = { 1, 2, 3, 4, 3, 2, 1 }, // Blink bitmap sequence
  blinkCountdown = 100, // Countdown to next blink (in frames)
  gazeCountdown  =  75, // Countdown to next eye movement
  gazeFrames     =  50, // Duration of eye movement (smaller = faster)
  mouthPos       =   0, // Current image number for mouth
  mouthCountdown =  10; // Countdown to next mouth change
int8_t
  eyeX = 3, eyeY = 3,   // Current eye position
  newX = 3, newY = 3,   // Next eye position
  dX   = 0, dY   = 0;   // Distance from prior to new position

void setup() {
  
  t.every(10000, takeReading);
  
  
  #ifdef DEBUG
  Serial.begin(9600);
#endif
  initDiagnosticLEDs();
  initPrinterID();
  initSD();
  initNetwork();
  initPrinter();
  //initBouncer();
  
  

  // Seed random number generator from an unused analog input:
  randomSeed(analogRead(A0));

  // Initialize each matrix object:
  for(uint8_t i=0; i<4; i++) {
    matrix[i].begin(matrixAddr[i]);
    matrix[i].setBrightness(2);
    // If using 'small' (1.2") displays vs. 'mini' (0.8"), enable this:
    // matrix[i].setRotation(3);
  }
}

void takeReading(){
     if (downloadWaiting) {
    //bouncer.update();
    //if (bouncer.read() == HIGH) {
      printFromDownload();
    //}
  } else {
    checkForDownload();
//    if (!downloadWaiting) {
//      //delay(pollingDelay);
//    }
  } 
}

void loop() {
  
   t.update();
  
  

  
  

  // Draw eyeball in current state of blinkyness (no pupil).  Note that
  // only one eye needs to be drawn.  Because the two eye matrices share
  // the same address, the same data will be received by both.
  matrix[MATRIX_EYES].clear();
  // When counting down to the next blink, show the eye in the fully-
  // open state.  On the last few counts (during the blink), look up
  // the corresponding bitmap index.
  matrix[MATRIX_EYES].drawBitmap(0, 0,
    blinkImg[
      (blinkCountdown < sizeof(blinkIndex)) ? // Currently blinking?
      blinkIndex[blinkCountdown] :            // Yes, look up bitmap #
      0                                       // No, show bitmap 0
    ], 8, 8, LED_ON);
  // Decrement blink counter.  At end, set random time for next blink.
  if(--blinkCountdown == 0) blinkCountdown = random(5, 180);

  // Add a pupil (2x2 black square) atop the blinky eyeball bitmap.
  // Periodically, the pupil moves to a new position...
  if(--gazeCountdown <= gazeFrames) {
    // Eyes are in motion - draw pupil at interim position
    matrix[MATRIX_EYES].fillRect(
      newX - (dX * gazeCountdown / gazeFrames),
      newY - (dY * gazeCountdown / gazeFrames),
      2, 2, LED_OFF);
    if(gazeCountdown == 0) {    // Last frame?
      eyeX = newX; eyeY = newY; // Yes.  What's new is old, then...
      do { // Pick random positions until one is within the eye circle
        newX = random(7); newY = random(7);
        dX   = newX - 3;  dY   = newY - 3;
      } while((dX * dX + dY * dY) >= 10);      // Thank you Pythagoras
      dX            = newX - eyeX;             // Horizontal distance to move
      dY            = newY - eyeY;             // Vertical distance to move
      gazeFrames    = random(3, 15);           // Duration of eye movement
      gazeCountdown = random(gazeFrames, 120); // Count to end of next movement
    }
  } else {
    // Not in motion yet -- draw pupil at current static position
    matrix[MATRIX_EYES].fillRect(eyeX, eyeY, 2, 2, LED_OFF);
  }

  // Draw mouth, switch to new random image periodically
  drawMouth(mouthImg[mouthPos]);
  if(--mouthCountdown == 0) {
    mouthPos = random(6); // Random image
    // If the 'neutral' position was chosen, there's a 1-in-5 chance we'll
    // select a longer hold time.  This gives the appearance of periodic
    // pauses in speech (e.g. between sentences, etc.).
    mouthCountdown = ((mouthPos == 0) && (random(5) == 0)) ?
      random(10, 40) : // Longer random duration
      random(2, 8);    // Shorter random duration
  }

  // Refresh all of the matrices in one quick pass
  for(uint8_t i=0; i<4; i++) matrix[i].writeDisplay();

  delay(20); // ~50 FPS
}

// Draw mouth image across three adjacent displays
void drawMouth(const uint8_t *img) {
  for(uint8_t i=0; i<3; i++) {
    matrix[MATRIX_MOUTH_LEFT + i].clear();
    matrix[MATRIX_MOUTH_LEFT + i].drawBitmap(i * -8, 0, img, 24, 8, LED_ON);
  }
}





// -- Settings for YOU to change if you want



// -- Debugging

#ifdef DEBUG
void debugTimeAndSeparator() {
  Serial.print(millis()); Serial.print(": ");
}
void debug(const char *a) {
  debugTimeAndSeparator(); Serial.println(a);
}
#define debug2(a, b) debugTimeAndSeparator(); Serial.print(a); Serial.println(b);
#else
#define debug(a)
#define debug2(a, b)
#endif


// -- Initialize the printer ID

const byte idAddress = 0;
char printerId[17]; // the unique ID for this printer.

inline void initPrinterID() {
  if ((EEPROM.read(idAddress) == 255) || (EEPROM.read(idAddress+1) == 255)) {
    debug("Generating new ID");
    randomSeed(analogRead(0) * analogRead(5));
    for(int i = 0; i < 16; i += 2) {
      printerId[i] = random(48, 57); // 0-9
      printerId[i+1] = random(97, 122); // a-z
      EEPROM.write(idAddress + i, printerId[i]);
      EEPROM.write(idAddress + i+1, printerId[i+1]);
    }
  } else {
    for(int i = 0; i < 16; i++) {
      printerId[i] = (char)EEPROM.read(idAddress + i);
    }
  }
  printerId[16] = '\0';
  debug2("ID: ", printerId);
}


// -- Initialize the LEDs

inline void initDiagnosticLEDs() {
  pinMode(errorLED, OUTPUT);
  pinMode(downloadLED, OUTPUT);
  pinMode(readyLED, OUTPUT);
  digitalWrite(errorLED, HIGH);
  digitalWrite(downloadLED, HIGH);
  digitalWrite(readyLED, HIGH);
  delay(1000);
  digitalWrite(errorLED, LOW);
  digitalWrite(downloadLED, LOW);
  digitalWrite(readyLED, LOW);
  delay(500);
}

// -- Initialize the printer connection

SoftwareSerial *printer;
#define PRINTER_WRITE(b) printer->write(b)

inline void initPrinter() {
  printer = new SoftwareSerial(printer_RX_Pin, printer_TX_Pin);
  printer->begin(19200);
}


// -- Initialize the SD card

inline void initSD() {
  pinMode(SD_Pin, OUTPUT);
  if (!SD.begin(SD_Pin)) {
    // SD Card failure.
    terminalError(2);
  }
}

// -- Initialize the Ethernet connection & DHCP

EthernetClient client;
inline void initNetwork() {
  // start the Ethernet connection:
  if (Ethernet.begin(mac) == 0) {
    // DHCP Failure
    terminalError(3);
  }
  delay(1000);
  // print your local IP address:
  debug2("IP: ", Ethernet.localIP());
}


// -- Initialize debouncing of buttons

//Bounce bouncer = Bounce();

//void initBouncer() {
//  bouncer.attach(buttonPin);
//  bouncer.interval(5);
//}




void checkForDownload() {
  unsigned long length = 0;
  content_length = 0;
  statusOk = false;

#ifdef DEBUG
  unsigned long start = millis();
#endif

  if (SD.exists(cacheFilename)) {
    if (!SD.remove(cacheFilename)) {
      // Failed to clear cache.
      terminalError(4);
    }
  }
  File cache = SD.open(cacheFilename, FILE_WRITE);

  debug2("Attempting to connect to ", host);
  if (client.connect(host, port)) {
    digitalWrite(downloadLED, HIGH);
    client.print("GET "); client.print("/printer/"); client.print(printerId); client.println(" HTTP/1.0");
    client.print("Host: "); client.print(host); client.print(":"); client.println(port);
    client.flush();
    client.print("Accept: application/vnd.exciting.printer."); client.println(printerType);
    client.print("X-Printer-Version: "); client.println(sketchVersion);
    client.println();
    boolean parsingHeader = true;

    while(client.connected()) {
      while(client.available()) {
        if (parsingHeader) {
          client.find((char*)"HTTP/1.1 ");
          char statusCode[] = "xxx";
          client.readBytes(statusCode, 3);
          statusOk = (strcmp(statusCode, "200") == 0);
          client.find((char*)"Content-Length: ");
          char c;
          while (isdigit(c = client.read())) {
            content_length = content_length*10 + (c - '0');
          }
          debug2("Content length: ", content_length);
          client.find((char*)"\n\r\n"); // the first \r may already have been read above
          parsingHeader = false;
        } else {
          cache.write(client.read());
          length++;
        }
      }
      debug("Waiting for data");
    }

    debug("Server disconnected");
    digitalWrite(downloadLED, LOW);
    // Close the connection, and flush any unwritten bytes to the cache.
    client.stop();
    cache.seek(0);

    if (statusOk) {
      if ((content_length == length) && (content_length == cache.size())) {
        if (content_length > 0) {
          downloadWaiting = true;
          digitalWrite(readyLED, HIGH);
        }
      }
#ifdef DEBUG
      else {
        debug2("Failure, content length: ", content_length);
        if (content_length != length) debug2("length: ", length);
        if (content_length != cache.size()) debug2("cache: ", cache.size());
        digitalWrite(errorLED, HIGH);
      }
#endif
    } else {
      debug("Response code != 200");
      recoverableError();
    }
  } else {
    debug("Couldn't connect");
    recoverableError();
  }

  cache.close();

#ifdef DEBUG
  unsigned long duration = millis() - start;
  debug2("Bytes: ", length);
  debug2("Duration: ", duration);
#endif
}

void flashErrorLEDs(unsigned int times, unsigned int pause) {
  while (times--) {
    digitalWrite(errorLED, HIGH); delay(pause);
    digitalWrite(errorLED, LOW); delay(pause);
  }
}

inline void recoverableError() {
  flashErrorLEDs(5, 100);
}

inline void terminalError(unsigned int times) {
  flashErrorLEDs(times, 500);
  digitalWrite(errorLED, HIGH);
  // no point in carrying on, so do nothing forevermore:
  while(true);
}

// -- Print send any data from the cache to the printer

inline void printFromDownload() {
  File cache = SD.open(cacheFilename);
  byte b;
  while (content_length--) {
    b = (byte)cache.read();
    PRINTER_WRITE(b);
  }
  cache.close();
  downloadWaiting = false;
  digitalWrite(readyLED, LOW);
}

