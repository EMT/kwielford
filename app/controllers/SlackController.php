<?php

namespace app\controllers;

use app\models\Slack;
use lithium\action\DispatchException;

class SlackController extends \li3_fieldwork\extensions\action\Controller {

	public function index() {
		if ($this->request->data) {
			return 'Hello, this is Kwielford. What can I do for you?';
		}
	}

}

?>