<?php

namespace app\controllers;

use app\models\Users;
use lithium\action\DispatchException;

class UsersController extends \li3_auth\controllers\UsersController {

	public function index() {
		$users = Users::all();
		return compact('users');
	}

	public function view() {
		$user = Users::findById($this->request->id);
		return compact('user');
	}

	public function add() {
		$user = Users::create();

		if (($this->request->data) && $user->save($this->request->data)) {
			return $this->redirect(['Users::view', 'id' => $user->id]);
		}

		return compact('user');
	}

	public function edit() {
		$user = Users::findById($this->request->id);

		if (!$user) {
			return $this->redirect('Users::index');
		}

		if (($this->request->data) && $user->save($this->request->data)) {
			return $this->redirect(['Users::view', 'id' => $user->id]);
		}

		return compact('user');
	}

	public function delete() {
		if (!$this->request->is('post') && !$this->request->is('delete')) {
			$msg = "Users::delete can only be called with http:post or http:delete.";
			throw new DispatchException($msg);
		}

		Users::findById($this->request->id)->delete();
		return $this->redirect('Users::index');
	}
}

?>