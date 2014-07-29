<?php

namespace app\controllers;

use app\models\Slack;
use lithium\storage\Cache;
use lithium\action\DispatchException;


class SlackController extends \li3_fieldwork\extensions\action\Controller {

	public function incoming() {
		if ($this->request->data) {
			$text = trim($this->request->data['text']);

			if (!$text) {
				return 'Hello, this is Kwielford. What can I do for you?';
			}

			$commands = [
				'help' => function($data) {
			 		return "Some things you can ask me to do…\n\nReminders\n---------\n/kwiz remind me at 2pm to do that thing\n/kwiz remind me on thursday at 9am to do that other thing\n/kwiz remind me at 3pm on 25 aug to do that thing in the distant future.";
				},
				'be' => function($data) {
					// TODO: change mood
				},
				'say' => function($data) {
					$d = ['content' => '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Document</title></head><body>' . $data . '</body></html>'];
					$response = json_decode($this->_postToUrl('http://printer.exciting.io/print/4h6s3f3s8v7v2h3p', $d));
				var_dump($response);
					if ($response['response'] === 'ok') {
				var_dump('test');
						return 'Printing… ' . $data;
					}

					return 'Something is wrong. My mouth won’t work.';
				},
				'remind' => function($data) {
					// TODO: implement reminders
				}
			];

			foreach ($commands as $key => $command) {
				if (strpos($text, $key) === 0) {
					$data = substr($text, strlen($key));
					return $command($data);
				}
			}

			return 'I don’t understand “' . $text . '”';
			
			// switch ($command) {
				
			// 	case '':
			// 		return 'Hello, this is Kwielford. What can I do for you?';

			// 	case 'help':
			// 		return "Some things you can ask me to do…\n\nReminders\n---------\n/kwiz remind me at 2pm to do that thing\n/kwiz remind me on thursday at 9am to do that other thing\n/kwiz remind me at 3pm on 25 aug to do that thing in the distant future.";

			// 	case 'be happy':
			// 		// Cache::write('default', 'k-mood', 'happy');
			// 		// return file_get_contents('http://10.0.1.52/?mood=happy');
			// 		return "I am happy.";

			// 	case 'be neutral':
			// 		// Cache::write('default', 'k-mood', 'neutral');
			// 		file_get_contents('http://10.0.1.52/?mood=neutral');
			// 		return "I am neutral.";

			// 	case 'be angry':
			// 		// Cache::write('default', 'k-mood', 'angry');
			// 		file_get_contents('http://10.0.1.52/?mood=angry');
			// 		return "I am angry.";

			// 	case 'remind':
			// 		// TODO: implement reminders
				
			// 	case 'say':


			// 	default:
			// 		return 'I don’t understand “' . $text . '”';
			// }

		}

		return 'Something';
	}

	public function _postToUrl($url, $data) {
		// use key 'http' even if you send the request to https://...
		$options = array(
		    'http' => array(
		        'header'  => "Content-type: application/x-www-form-urlencoded\r\n" . 
		        			"Accept: application/json\r\n",
		        'method'  => 'POST',
		        'content' => http_build_query($data),
		    ),
		);
		$context  = stream_context_create($options);
		$result = file_get_contents($url, false, $context);

		return $result;
	}

}

?>