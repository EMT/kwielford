<?php

namespace app\controllers;

use app\models\Faces;
use lithium\action\DispatchException;

class FacesController extends \lithium\action\Controller {

	public function index() {
		$faces = Faces::all();
		return compact('faces');
	}

	public function get() {
		$face = Faces::findById($this->request->id);

		if (!$face) {
			throw new \Exception('Face not found.', 404);
		}
		
		return compact('face');
	}

	public function add() {
		$face = Faces::create();

		if (($this->request->data) && $face->save($this->request->data)) {
			return compact('face');
		}
		
		return ['errors' => compact($face->errors())];
	}

	public function update() {
		$face = Faces::find($this->request->id);

		if (!$face) {
			throw new \Exception('Face not found.', 404);
		}

		if (($this->request->data) && $face->save($this->request->data)) {
			return compact('face');
		}
		return compact('face');
	}

	public function delete() {
		if (!$this->request->is('post') && !$this->request->is('delete')) {
			$msg = "Faces::delete can only be called with http:post or http:delete.";
			throw new DispatchException($msg);
		}
		Faces::find($this->request->id)->delete();
		return ['success' => true];
	}
}

?>