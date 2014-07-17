<?php

namespace app\controllers;

use app\models\Slack;
use lithium\storage\Cache;
use lithium\action\DispatchException;


class SlackController extends \li3_fieldwork\extensions\action\Controller {

	public function incoming() {
		if ($this->request->data) {
			$text = trim($this->request->data['text']);
			
			switch($text) {
				
				case '':
					return 'Hello, this is Kwielford. What can I do for you?';

				case 'help':
					return "Some things you can ask me to do…\n\nReminders\n---------\n/kwiz remind me at 2pm to do that thing\n/kwiz remind me on thursday at 9am to do that other thing\n/kwiz remind me at 3pm on 25 aug to do that thing in the distant future.";

				case 'be happy':
					Cache::write('default', 'k-mood', 'happy');
					file_get_contents('http://10.0.1.52/?mood=happy');
					return "I am happy.";

				case 'be neutral':
					Cache::write('default', 'k-mood', 'neutral');
					file_get_contents('http://10.0.1.52/?mood=neutral');
					return "I am neutral.";

				case 'be angry':
					Cache::write('default', 'k-mood', 'angry');
					file_get_contents('http://10.0.1.52/?mood=angry');
					return "I am angry.";

				case 'remind':
					// TODO: implement reminders

				default:
					return 'I don’t understand “' . $text . '”';
			}

		}
	}

}

?>