<?php

namespace app\controllers;

use app\models\MoodMetrics;
use app\models\Faces;
use lithium\action\DispatchException;


class MetaController extends \li3_fieldwork\extensions\action\Controller {

	public function mood() {
		$currentMood = MoodMetrics::currentMood();
		$mood = [
			'mood' => $currentMood->moodAsString(),
			'face' => Faces::faceForMood($currentMood),
			'metrics' => $currentMood->data()
		];
		// $mood = [
		// 	'happy' => [
		// 		'face' => [
		// 			['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
		//             ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
		//             ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
		//             ['0', '0', '0', '1', '1', '1', '0', '0', '0', '1', '0', '0', '0', '0', '0', '0'],
		//             ['0', '0', '0', '1', '1', '1', '0', '0', '0', '1', '1', '0', '0', '0', '0', '0'],
		//             ['0', '0', '0', '1', '1', '1', '0', '0', '0', '1', '1', '1', '0', '0', '0', '0'],
		//             ['0', '0', '0', '0', '0', '0', '0', '0', '0', '1', '1', '1', '1', '0', '0', '0'],
		//             ['0', '0', '0', '0', '0', '0', '0', '0', '0', '1', '1', '1', '1', '1', '0', '0'],
		//             ['0', '0', '0', '0', '0', '0', '0', '0', '0', '1', '1', '1', '1', '1', '0', '0'],
		//             ['0', '0', '0', '0', '0', '0', '0', '0', '0', '1', '1', '1', '1', '1', '0', '0'],
		//             ['0', '0', '0', '1', '1', '1', '0', '0', '0', '1', '1', '1', '1', '1', '0', '0'],
		//             ['0', '0', '0', '1', '1', '1', '0', '0', '0', '1', '1', '1', '1', '1', '0', '0'],
		//             ['0', '0', '0', '1', '1', '1', '0', '0', '0', '1', '1', '1', '1', '1', '0', '0'],
		//             ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
		//             ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
		//             ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0']
		// 		]
		// 	]
		// ];
		return compact('mood');
	}

	public function face() {
		$face = Faces::faceForMood(MoodMetrics::currentMood());
		
		if (!empty($this->request->query['mode']) && $this->request->query['mode'] === 'arduino') {
			return ['face' => $face->forArduino()];
		}

		return ['face' => $face->data()];
	}

	public function initMood() {
		$mood = MoodMetrics::create()->save([
			'energy' => 50,
			'stress' => 50,
			'hunger' => 50,
			'thirst' => 50,
			'temperature' => 50,
			'sociability' => 50
		]);
	}

}

?>