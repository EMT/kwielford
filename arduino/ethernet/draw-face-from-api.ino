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
static const uint8_t matrixAddr[] = { 0x71, 0x72, 0x73, 0x70};

uint8_t mouthImg[][32] = {                 // Mouth animation frames

  { B00000000, B00000000, B00000000, B00000000, // Mouth position A
    B00000000, B00000000, B00000111, B10000000,
    B00000001, B11100000, B00001000, B01000000,
    B00000010, B00010000, B00010000, B00100000,
    B00000100, B00001000, B00000000, B00000000,
    B00000000, B00000000, B00000000, B00000000,
    B00000000, B00000000, B00000000, B00000000,
    B00000000, B00000000, B00000000, B00000000 }
   };


/*
  DNS and DHCP-based Web client 
 
 Circuit:
 * Ethernet shield attached to pins 10, 11, 12, 13 
 */

#include <SPI.h>
#include <Ethernet.h>

#include <Timer.h>

Timer t;

// Enter a MAC address for your controller below.
byte mac[] = { 0x00, 0xAA, 0xBB, 0xCC, 0xDA, 0x02 };
char serverName[] = "api.kwielford.com";

String buffer = "";
int bufferArray[8];
int bufferDec = 0;


int i = 0;
int j = 0;

boolean readingData = false;
String currentLine = "";            // string to hold the text from server
String tweet = "";                  // string to hold the tweet
boolean readingTweet = false;       // if you're currently reading the tweet
boolean startRead = false;       // if you're currently reading the tweet

//String location = "/~liveupdate/scorestrip/scorestrip.json HTTP/1.0";
String location = "/meta/mood.json HTTP/1.0";

// Initialize the Ethernet client library
EthernetClient client;

void setup() {
  
  // Initialize each matrix object:
  for(uint8_t i=0; i<4; i++) {
    matrix[i].begin(matrixAddr[i]);
    matrix[i].setBrightness(5);
  }
  
  
  // start the serial library:
  Serial.begin(9600);
  // start the Ethernet connection:
  if (Ethernet.begin(mac) == 0) {
    Serial.println("Failed to configure Ethernet using DHCP");
    // no point in carrying on, so do nothing forevermore:
    while(true);
  }
  // give the Ethernet shield a second to initialize:
  delay(2000);

  t.every(20000, checkFace);

  // if you get a connection, report back via serial:
  
  
  
}

void checkFace(){
  Serial.println("connecting...");
  if (client.connect(serverName, 80)) {
    Serial.println("connected");
    // Make a HTTP request:
    client.println("GET /meta/face.json?mode=arduino HTTP/1.0");
    client.println();
  } 
  else {
    // if you didn't get a connection to the server:
    Serial.println("connection failed");
  }
  startRead = false;
}

void loop()
{
  t.update();
  // if there are incoming bytes available 
  // from the server, read them and print them:
  if (client.available()) {
    char inChar = client.read();
    Serial.print(inChar);
     // add incoming byte to end of line:
      
    if (inChar == '[' ) { //'<' is our begining character
      startRead = true; //Ready to start reading the part 
    }else if(startRead){
                
        if (inChar == '['){
          
        } else {
          if (j < 32){
            if (inChar == ',' || inChar == ']'){//end of number              
              mouthImg[0][j] = (byte)buffer.toInt();
              //Serial.println(buffer.toInt());
//              Serial.println(mouthImg[0][j]);
              //Serial.println(j);

              buffer = "";
              j++;
            } else {
              buffer += inChar;
              
            }
          } 
        }
       }
  }
  
    // Draw mouth, switch to new random image periodically
  drawMouth(mouthImg[0]);

  // Refresh all of the matrices in one quick pass
  for(uint8_t i=0; i<4; i++) matrix[i].writeDisplay();

  delay(2); // ~50 FPS


  // if the server's disconnected, stop the client:
  //if (!client.connected()) {
    if (j == 31){
      Serial.println("disconnecting.");
      client.stop();
      j = 0;
    }
}




// Draw mouth image across three adjacent displays
void drawMouth(const uint8_t *img) {
  for(uint8_t i=0; i<4; i++) {
    matrix[i].clear();
    matrix[i].drawBitmapRAM(i * -8, 0, img, 32, 8, LED_ON);
  }
}
