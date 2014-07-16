<?php

namespace app\controllers;

use app\models\Slack;
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
					// TODO change mood and face to happy
					return "I am happy.";

				default:
					return 'I don’t understand: ' . $text;
			}

		}
	}

}

?>