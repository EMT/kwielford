<?php

namespace app\controllers;

use app\models\Reminders;
use lithium\action\DispatchException;

class RemindersController extends \li3_fieldwork\extensions\action\Controller {


	public function view() {
		$reminder = Reminders::first($this->request->id);
		return compact('reminder');
	}

	public function add() {
		$reminder = Reminders::create();

		if (($this->request->data) && $reminder->save($this->request->data)) {
			return compact('reminder');
		}

		return false;
	}

	public function edit() {
		$reminder = Reminders::find($this->request->id);

		if ($reminder && ($this->request->data) && $reminder->save($this->request->data)) {
			return compact('reminder');
		}

		return false;
	}

	public function delete() {
		if (!$this->request->is('post') && !$this->request->is('delete')) {
			$msg = "Reminders::delete can only be called with http:post or http:delete.";
			throw new DispatchException($msg);
		}
		
		Reminders::find($this->request->id)->delete();
		return true;
	}
}

?>