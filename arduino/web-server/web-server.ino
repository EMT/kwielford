/*
  Web Server Demo
 thrown together by Randy Sarafan
 

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
byte mac[] = { 
  0x00, 0xAA, 0xBB, 0xCC, 0xDA, 0x02 };
IPAddress ip(10,0,1,52); //<<< ENTER YOUR IP ADDRESS HERE!!!

// Initialize the Ethernet server library
// with the IP address and port you want to use 
// (port 80 is default for HTTP):
EthernetServer server(80);

String HTTP_req;          // stores the HTTP request
boolean LED_status = 0;   // state of LED, off by default

int speed = 10; //the delay time in milliseconds

int pauseDelay = 1;    //the number of milliseconds to display each scanned line

//Pin Definitions
int rowA[] = {9,8,7,6,5,4,3,2};          //An Array defining which pin each row is attached to
                                         //(rows are common anode (drive HIGH))
//int colA[] = {17,16,15,14,13,12,11,10};  //An Array defining which pin each column is attached to
int colA[] = {17,16,15,14,0,1,18,19};    //(columns are common cathode (drive LOW))
                                         
                                         //NB Ethernet shield uses 10,11,12,13
                                         //A0 = 14, A1 = 15, A2 = 16 , A3 = 17, A4 = 18, A5 = 19

//The array used to hold a bitmap of the display 
//(if you wish to do something other than scrolling marque change the data in this
//variable then display)
byte data[] = {0,0,0,0,0,0,0,0}; 

void setup()
{
    Ethernet.begin(mac, ip);  // initialize Ethernet device
    server.begin();           // start to listen for clients
    //Serial.begin(9600);       // for diagnostics
    //pinMode(2, OUTPUT);       // LED on pin 2
    for(int i = 0; i <8; i++){  //Set the 16 pins used to control the array as OUTPUTs
      pinMode(rowA[i], OUTPUT);
      pinMode(colA[i], OUTPUT);
  }
}


void loop()
{
    EthernetClient client = server.available();  // try to get client

    if (client) {  // got client?
        boolean currentLineIsBlank = true;
        while (client.connected()) {
            if (client.available()) {   // client data available to read
                char c = client.read(); // read 1 byte (character) from client
                HTTP_req += c;  // save the HTTP request 1 char at a time
                // last line of client request is blank and ends with \n
                // respond to client only after last line received
                if (c == '\n' && currentLineIsBlank) {
                    // send a standard http response header
                    client.println("HTTP/1.1 200 OK");
                    client.println("Content-Type: text/html");
                    client.println("Connection: close");
                    client.println();
                    // send web page
                    client.println("<!DOCTYPE html>");
                    client.println("<html>");
                    client.println("<head>");
                    client.println("<title>Arduino LED Control</title>");
                    client.println("</head>");
                    client.println("<body>");
                    client.println("<h1>LED</h1>");
                    client.println("<p>Click to switch LED on and off.</p>");
                    client.println("<form method=\"get\">");
                    ProcessCheckbox(client);
                    client.println("</form>");
                    client.println("</body>");
                    client.println("</html>");
                    //Serial.print(HTTP_req);
                    HTTP_req = "";    // finished with request, empty string
                    break;
                }
                // every line of text received from the client ends with \r\n
                if (c == '\n') {
                    // last character on line of received text
                    // starting new line with next character read
                    currentLineIsBlank = true;
                } 
                else if (c != '\r') {
                    // a text character was received from client
                    currentLineIsBlank = false;
                }
            } // end if (client.available())
        } // end while (client.connected())
        delay(1);      // give the web browser time to receive the data
        client.stop(); // close the connection
          
    } // end if (client)

    if (LED_status) {
        data[0] = B00000000; //row 1s bit mask (1 LED is on 0 LED is off)
        data[1] = B01000010; //row 1s bit mask (1 LED is on 0 LED is off)
        data[2] = B10100101; //row 1s bit mask (1 LED is on 0 LED is off)
        data[3] = B00000000; //row 1s bit mask (1 LED is on 0 LED is off)
        data[4] = B00000000; //row 1s bit mask (1 LED is on 0 LED is off)
        data[5] = B01000010; //row 1s bit mask (1 LED is on 0 LED is off)
        data[6] = B00111100; //row 1s bit mask (1 LED is on 0 LED is off)  
        data[7] = B00000000; //row 1s bit mask (1 LED is on 0 LED is off) 
      
      } else {
        data[0] = B00000000; //row 1s bit mask (1 LED is on 0 LED is off)
        data[1] = B01000010; //row 1s bit mask (1 LED is on 0 LED is off)
        data[2] = B00100100; //row 1s bit mask (1 LED is on 0 LED is off)
        data[3] = B00000000; //row 1s bit mask (1 LED is on 0 LED is off)
        data[4] = B00000000; //row 1s bit mask (1 LED is on 0 LED is off)
        data[5] = B00111100; //row 1s bit mask (1 LED is on 0 LED is off)
        data[6] = B01000010; //row 1s bit mask (1 LED is on 0 LED is off)  
        data[7] = B00000000; //row 1s bit mask (1 LED is on 0 LED is off) 
      }
      showSprite(speed);
}

// switch LED and send back HTML for LED checkbox
void ProcessCheckbox(EthernetClient cl)
{
    if (HTTP_req.indexOf("LED2=2") > -1) {  // see if checkbox was clicked
        // the checkbox was clicked, toggle the LED
        if (LED_status) {
            LED_status = 0;
        }
        else {
            LED_status = 1;
        }
    }
    
    if (LED_status) {    // switch LED on
        // checkbox is checked
        cl.println("<input type=\"checkbox\" name=\"LED2\" value=\"2\" \
        onclick=\"submit();\" checked>LED2");
    }
    else {              // switch LED off
        // checkbox is unchecked
        cl.println("<input type=\"checkbox\" name=\"LED2\" value=\"2\" \
        onclick=\"submit();\">LED2");
    }
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
   delay(pauseDelay);                       //leave the column on for pauseDelay microseconds (too high a delay causes flicker)
  } 
 }
}