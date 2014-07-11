/*
  Web Server Demo
  thrown together by Randy Sarafan
 
 Allows you to turn on and off an LED by entering different urls.
 
 To turn it on:
 http://your-IP-address/$1
 
 To turn it off:
 http://your-IP-address/$2
 
 Circuit:
 * Ethernet shield attached to pins 10, 11, 12, 13
 * Connect an LED to pin D2 and put it in series with a 220 ohm resistor to ground
 
 Based almost entirely upon Web Server by Tom Igoe and David Mellis
 
 Edit history: 
 created 18 Dec 2009
 by David A. Mellis
 modified 4 Sep 2010
 by Tom Igoe
 
 */

#include <SPI.h>
#include <Ethernet.h>
#include <WString.h>

boolean incoming = 0;
String readString;


// Enter a MAC address and IP address for your controller below.
// The IP address will be dependent on your local network:
byte mac[] = { 0x00, 0xAA, 0xBB, 0xCC, 0xDA, 0x02 };
IPAddress ip(10,0,1,52); //<<< ENTER YOUR IP ADDRESS HERE!!!

// Initialize the Ethernet server library
// with the IP address and port you want to use 
// (port 80 is default for HTTP):
EthernetServer server(80);







/*
 * Example Code for an 8 x 8 LED Matrix
 * For More Details Visit http://www.tinyurl.com/yhwxv6h
 *
 * Scrolls a message across an 8 x 8 LED Matrix
 * To adjust the speed change the variable speed.
 * The message is held in requestString[]
 */


int speed = 20; //number of times to repeat each frame
int pauseDelay = 500;  //microseconds to leave each row  on before moving to the next

char requestString[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";  //The string to display
                                           //to change the message in code you right yourself simply 
                                           //change this data and reset index and offset to 0
//Variables used for scrolling (both start at 0
int index = 0;  //this is the current charachter in the string being displayed
int offset = 3; //this is how many columns it is offset by

//Pin Definitions
int rowA[] = {9,8,7,6,5,4,3,2};          //An Array defining which pin each row is attached to
                                         //(rows are common anode (drive HIGH))
int colA[] = {17,16,15,14,13,12,11,10};  //An Array defining which pin each column is attached to
                                         //(columns are common cathode (drive LOW))

//Constants defining each charachters position in an array of integer arrays
//Letters
const int A = 0;  const int B = 1;  const int C = 2;  const int D = 3;  const int E = 4;
const int F = 5;  const int G = 6;  const int H = 7;  const int I = 8;  const int J = 9;  
const int K = 10; const int L =11;  const int M = 12; const int N = 13; const int O = 14; 
const int P = 15; const int Q =16;  const int R = 17; const int S = 18; const int T = 19; 
const int U = 20; const int V =21;  const int W = 22; const int X = 23; const int Y = 24; 
const int Z = 25;

//Punctuation
const int COL =26; const int DASH = 27; const int BRA2 = 28; const int  _ = 29; const int LINE = 34;
const int DOT =36;

//Extra Charchters
const int  FULL =30; const int CHECK = 31; const int B2 = 32; const int TEMP = 33; 
const int SMILE =35; const int COLDOT = 36;


//The array used to hold a bitmap of the display 
//(if you wish to do something other than scrolling marque change the data in this
//variable then display)
byte data[] = {0,0,0,0,0,0,0,0};        

//The alphabet
//Each Charachter is an 8 x 7 bitmap where 1 is on and 0 if off
const int _A[] = {B0000,
                  B0000,
                  B0100,
                  B1010,
                  B1110,
                  B1010,
                  B0000,
                  B0000};

const int _B[] = {B0000,
                  B0000,
                  B1110,
                  B1110,
                  B1010,
                  B1110,
                  B0000,
                  B0000};

const int _C[] = {B0000,
                  B0000,
                  B1110,
                  B1000,
                  B1000,
                  B1110,
                  B0000,
                  B0000};

const int _D[] = {B0000,
                  B0000,
                  B1100,
                  B1010,
                  B1010,
                  B1100,
                  B0000,
                  B0000};

const int _E[] = {B0000,
                  B0000,
                  B1110,
                  B1100,
                  B1000,
                  B1110,
                  B0000,
                  B0000};

const int _F[] = {B0000,
                  B0000,
                  B1110,
                  B1100,
                  B1000,
                  B1000,
                  B0000,
                  B0000};

const int _G[] = {B0000,
                  B0000,
                  B1110,
                  B1000,
                  B1010,
                  B1110,
                  B0000,
                  B0000};

const int _H[] = {B0000,
                  B0000,
                  B1010,
                  B1110,
                  B1010,
                  B1010,
                  B0000,
                  B0000};

const int _I[] = {B0000,
                  B0000,
                  B1000,
                  B1000,
                  B1000,
                  B1000,
                  B0000,
                  B0000};

const int _J[] = {B0000,
                  B0000,
                  B1110,
                  B0100,
                  B0100,
                  B1100,
                  B0000,
                  B0000};

const int _K[] = {B0000,
                  B0000,
                  B1010,
                  B1100,
                  B1100,
                  B1010,
                  B0000,
                  B0000};

const int _L[] = {B0000,
                  B0000,
                  B1000,
                  B1000,
                  B1000,
                  B1110,
                  B0000,
                  B0000};

const int _M[] = {B0000,
                  B0000,
                  B1010,
                  B1110,
                  B1110,
                  B1010,
                  B0000,
                  B0000};

const int _N[] = {B0000,
                  B0000,
                  B1110,
                  B1010,
                  B1010,
                  B1010,
                  B0000,
                  B0000};

const int _O[] = {B0000,
                  B0000,
                  B1110,
                  B1010,
                  B1010,
                  B1110,
                  B0000,
                  B0000};

const int _P[] = {B0000,
                  B0000,
                  B1110,
                  B1010,
                  B1110,
                  B1000,
                  B0000,
                  B0000};

const int _Q[] = {B0000,
                  B0000,
                  B1110,
                  B1010,
                  B1110,
                  B0010,
                  B0000,
                  B0000};

const int _R[] = {B0000,
                  B0000,
                  B1100,
                  B1010,
                  B1110,
                  B1010,
                  B0000,
                  B0000};

const int _S[] = {B0000,
                  B0000,
                  B1110,
                  B1000,
                  B0110,
                  B1010,
                  B0000,
                  B0000};

const int _T[] = {B0000,
                  B0000,
                  B1110,
                  B0100,
                  B0100,
                  B0100,
                  B0000,
                  B0000};

const int _U[] = {B0000,
                  B0000,
                  B1010,
                  B1010,
                  B1010,
                  B1110,
                  B0000,
                  B0000};

const int _V[] = {B0000,
                  B0000,
                  B1010,
                  B1010,
                  B0100,
                  B0100,
                  B0000,
                  B0000};
                  
const int _W[] = {B0000,
                  B0000,
                  B1010,
                  B1010,
                  B1110,
                  B1110,
                  B0000,
                  B0000};

const int _X[] = {B0000,
                  B0000,
                  B1010,
                  B0100,
                  B0100,
                  B1010,
                  B0000,
                  B0000};

const int _Y[] = {B0000,
                  B0000,
                  B1010,
                  B0100,
                  B0100,
                  B0100,
                  B0000,
                  B0000};

const int _Z[] = {B0000,
                  B0000,
                  B1110,
                  B0100,
                  B1000,
                  B1110,
                  B0000,
                  B0000};

const int _COL[] = {B0000000,
                  B0011000,
                  B0011000,
                  B0000000,
                  B0011000,
                  B0011000,
                  B0000000,
                       B0000000};

const int _DASH[] = {B0000000,
                  B0000000,
                  B0000000,
                  B0111110,
                  B0000000,
                  B0000000,
                  B0000000,
                       B0000000};

const int _BRA2[] = {B0010000,
                  B0001000,
                  B0000100,
                  B0000100,
                  B0001000,
                  B0010000,
                  B0000000,
                       B0000000};                  

const int __[] = {B0000000,
                  B0000000,
                  B0000000,
                  B0000000,
                  B0000000,
                  B0000000,
                  B0000000,
                       B0000000};

const int _FULL[] = {B1111111,
                     B1111111,
                     B1111111,
                     B1111111,
                     B1111111,
                     B1111111,
                     B1111111,
                       B0000000};                  

const int _CHECK[] = {B1010101,
                     B0101010,
                     B1010101,
                     B0101010,
                     B1010101,
                     B0101010,
                     B1010101,
                       B0000000};
                  
const int _B2[] = {B0111110,
                   B0000001,
                   B0000001,
                   B0001111,
                   B0000001,
                   B1000001,
                   B0111110,
                       B0000000};

const int _TEMP[] = {B0000011,
                     B0011111,
                     B0111111,
                     B1111110,
                     B1111111,
                     B0011111,
                     B0000011,
                       B0000000};

const int _LINE[] = {B0000001,
                     B0000001,
                     B0000001,
                     B0000001,
                     B0000001,
                     B0000001,
                     B0000001,
                       B0000000};                     
                 
const int _SMILE[] = {B000000,
                      B1100100,
                      B1100010,
                      B0011001,
                      B1100010,
                      B1100100,
                      B0000000,
                      B0000000};                     
                  

const int _DOT[] = {B0000000,
                  B0000000,
                  B0000000,
                  B0000000,
                  B1100000,
                  B1100000,
                  B0000000,
                  B0000000};                     
                  
const int _COLDOT[] = {B0000000,
                       B0110000,
                       B0110000,
                       B0000000,
                       B0110011,
                       B0110011,
                       B0000000,
                       B0000000};                  

//Load the bitmap charachters into an array (each charachters position corresponds to its previously defined index (ie _A (a's bitmap) 
//is at index 0 and A = 0 so letters[A] will return the 'A' bitmap)
const int* letters[] = {_A,_B,_C,_D,_E,_F,_G,_H,_I,_J,_K,_L,_M,_N,_O,_P,_Q,_R,_S,_T,_U,_V,_W,_X,_Y,_Z,_COL,_DASH,_BRA2,__, _FULL, _CHECK, _B2, _TEMP, _LINE, _SMILE, _DOT, _COLDOT};

//Setup runs once when power is applied
// void setup()
// { 

// }

void setup()
{
  pinMode(2, OUTPUT);

  // start the Ethernet connection and the server:
  Ethernet.begin(mac, ip);
  server.begin();
  Serial.begin(9600);

  for(int i = 0; i <8; i++){  //Set the 16 pins used to control the array as OUTPUTs
    pinMode(rowA[i], OUTPUT);
    pinMode(colA[i], OUTPUT);
  }
}

//repeats
void loop()
{
  // listen for incoming clients
  EthernetClient client = server.available();
  if (client) {
    // an http request ends with a blank line
    boolean currentLineIsBlank = true;
    while (client.connected()) {
      if (client.available()) {
        char c = client.read();
        // if you've gotten to the end of the line (received a newline
        // character) and the line is blank, the http request has ended,
        // so you can send a reply
        
        //reads URL string from $ to first blank space
        if(incoming && c == ' '){ 
          incoming = 0;
        }

        
        //if (readString.length() < 100) {

          //store characters to string 
          readString += c; 
          Serial.print(c); //print what server receives to serial monitor
        //}
        
        //Checks for the URL string $1 or $2
         // Serial.println(c);
          
          if(c == '1'){
            Serial.println("ON");
            digitalWrite(2, HIGH);
            updateMatrix();
          }
          if(c == '2'){
            Serial.println("OFF");
            digitalWrite(2, LOW);
          }
        

        if (c == '\n') {
          // you're starting a new line
          currentLineIsBlank = true;
        } 
        else if (c != '\r') {
          // you've gotten a character on the current line
          currentLineIsBlank = false;
        }
      }
    }
    // give the web browser time to receive the data
    
    client.println("HTTP/1.1 200 OK");
          client.println("Content-Type: text/html");
          client.println();

          client.println("<HTML>");
          client.println("<HEAD>");
          client.println("<TITLE>Arduino GET test page</TITLE>");
          client.println("</HEAD>");
          client.println("<BODY>");

          client.println("<H1>HTML form GET example</H1>");

          client.println("<FORM ACTION=\"http://192.168.1.102:84\" method=get >");

          client.println("Pin 5 \"on\" or \"off\": <INPUT TYPE=TEXT NAME=\"LED\" VALUE=\"\" SIZE=\"25\" MAXLENGTH=\"50\"><BR>");

          client.println("<INPUT TYPE=SUBMIT NAME=\"submit\" VALUE=\"Change Pin 5!\">");

          client.println("</FORM>");

          client.println("<BR>");

          client.println("</BODY>");
          client.println("</HTML>");
    
    
    delay(1);
    // close the connection:
    client.stop();
  }
} 
// void loop()
// {
//  updateMatrix();
// }



void updateMatrix(){
  loadSprite();
  showSprite(speed);
}


//An array holding the powers of 2 these are used as bit masks when calculating what to display
const int powers[] = {1,2,4,8,16,32,64,128};

//Loads the current scroll state frame into the data[] display array
void loadSprite(){
  int currentChar = getChar(requestString[index]);
  int nextChar = getChar(requestString[index+1]);
  
  for(int row=0; row < 8; row++){                    //iterate through each row
    data[row] = 0;                                   //reset the row we're working on
    for(int column=0; column < 8; column++){         //iterate through each column
     data[row] = data[row] + ((powers[column] & (letters[currentChar][row] << offset)));   //loads the current charachter offset by offset pixels 
     data[row] = data[row] + (powers[column] & (letters[nextChar][row] >> (5-offset) ));   //loads the next charachter offset by offset pixels
    }
  }
  offset++;                                          //increment the offset by one row
  if(offset==8){offset = 0; index++; if(index==sizeof(requestString)-2){index=0;}}         //if offset is 8 load the next charachter pair for the next time through
}

void showSprite(int speed2){
 for(int iii = 0; iii < speed2; iii++){                 //show the current frame speed2 times
  for(int column = 0; column < 8; column++){            //iterate through each column
   for(int i = 0; i < 8; i++){                          
       digitalWrite(rowA[i], LOW);                      //turn off all row pins  
   }
   for(int i = 0; i < 8; i++){ //Set only the one pin
     if(i == column){     digitalWrite(colA[i], LOW);}  //turns the current row on
     else{                digitalWrite(colA[i], HIGH); }//turns the rest of the rows off
   }

   for(int row = 0; row < 8; row++){                    //iterate through each pixel in the current column
    int bit = (data[column] >> row) & 1;
    if(bit == 1){ 
       digitalWrite(rowA[row], HIGH);                   //if the bit in the data array is set turn the LED on
    }

   }
   delayMicroseconds(pauseDelay);                       //leave the column on for pauseDelay microseconds (too high a delay causes flicker)
  } 
 }
}

//returns the index of a given charachter
//for converting from a string to a lookup in our array of charachter bitmaps
int getChar(char charachter){
 int returnValue = Z;
 switch(charachter){
  case 'A': returnValue = A; break;
  case 'a': returnValue = A; break;
  case 'B': returnValue = B; break;
  case 'b': returnValue = B; break;
  case 'C': returnValue = C; break;
  case 'c': returnValue = C; break;
  case 'D': returnValue = D; break;
  case 'd': returnValue = D; break;
  case 'E': returnValue = E; break;
  case 'e': returnValue = E; break;
  case 'F': returnValue = F; break;
  case 'f': returnValue = F; break;
  case 'G': returnValue = G; break;
  case 'g': returnValue = G; break;
  case 'H': returnValue = H; break;
  case 'h': returnValue = H; break;
  case 'I': returnValue = I; break;
  case 'i': returnValue = I; break;
  case 'J': returnValue = J; break;
  case 'j': returnValue = J; break;
  case 'K': returnValue = K; break;
  case 'k': returnValue = K; break;
  case 'L': returnValue = L; break;
  case 'l': returnValue = L; break;
  case 'M': returnValue = M; break;
  case 'm': returnValue = M; break;
  case 'N': returnValue = N; break;
  case 'n': returnValue = N; break;
  case 'O': returnValue = O; break;
  case 'o': returnValue = O; break;
  case 'P': returnValue = P; break;
  case 'p': returnValue = P; break;
  case 'Q': returnValue = Q; break;
  case 'q': returnValue = Q; break;
  case 'R': returnValue = R; break;
  case 'r': returnValue = R; break;
  case 'S': returnValue = S; break;
  case 's': returnValue = S; break;
  case 'T': returnValue = T; break;
  case 't': returnValue = T; break;
  case 'U': returnValue = U; break;
  case 'u': returnValue = U; break;
  case 'V': returnValue = V; break;
  case 'v': returnValue = V; break;
  case 'W': returnValue = W; break;
  case 'w': returnValue = W; break;
  case 'X': returnValue = X; break;
  case 'x': returnValue = X; break;
  case 'Y': returnValue = Y; break;
  case 'y': returnValue = Y; break;
  case 'Z': returnValue = Z; break;
  case 'z': returnValue = Z; break;
  case ' ': returnValue = _; break;
  case '3': returnValue = B2; break;
  case '<': returnValue = TEMP; break;
  case '*': returnValue = FULL; break;
  case '|': returnValue = LINE; break;  
  case '_': returnValue = _; break;  
  case ':': returnValue = COL; break;  
  case '-': returnValue = DASH; break;  
  case ')': returnValue = BRA2; break;  
  case '%': returnValue = SMILE; break;  
  case '.': returnValue = DOT; break;    
  case '^': returnValue = COLDOT; break;      
  }
  return returnValue;
}