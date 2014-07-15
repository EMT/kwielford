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
					return "Some things you can ask me to do…\n\n";

				default:
					return 'You said: ' . $text;

		}
	}

}

?>